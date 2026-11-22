package be.bekijk.tv.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.URL
import java.util.Calendar
import java.util.TimeZone

@Serializable
data class GuidePayload(
    val updatedAt: String,
    val windowStartHour: Int = 6,
    // Begin van het venster in ms sinds epoch (UTC). 0 = onbekend (oudere guide.json).
    val windowStartTs: Long = 0L,
    val channels: List<ChannelDto>
)

@Serializable
data class ChannelDto(
    val id: String,
    val name: String,
    val category: String,
    val app: String,
    val androidPackage: String = "",
    val deepLink: String,
    // Badge in de app: korte naam en accentkleur (#RRGGBB). Leeg bij oudere guide.json.
    val shortName: String = "",
    val accentColor: String = "",
    val programs: List<ProgramDto>
)

@Serializable
data class ProgramDto(
    val title: String,
    val start: String,
    val end: String,
    val startMins: Int,
    val durationMins: Int,
    val genre: String,
    val desc: String
)

/** Favoriete programma's worden op titel bewaard (hoofdletterongevoelig). */
fun programFavoriteKey(title: String): String = title.trim().lowercase()

enum class ProgramStatus {
    LIVE,
    UPCOMING,
    PAST
}

object EpgTimeHelper {
    private val brusselsTz = TimeZone.getTimeZone("Europe/Brussels")

    fun currentMinutesSinceWindow(windowStartHour: Int, windowStartTs: Long = 0L): Int {
        if (windowStartTs > 0L) {
            return ((System.currentTimeMillis() - windowStartTs) / 60_000L).toInt()
        }
        val cal = Calendar.getInstance(brusselsTz)
        var hour = cal.get(Calendar.HOUR_OF_DAY)
        val minute = cal.get(Calendar.MINUTE)
        if (hour < 6 && windowStartHour >= 6) {
            hour += 24
        }
        return (hour - windowStartHour) * 60 + minute
    }

    /** "Vandaag" / "Morgen" / "Later" voor een programma, op basis van Brusselse kalenderdagen. */
    fun dayLabel(windowStartTs: Long, startMins: Int): String {
        if (windowStartTs <= 0L) return ""
        fun localDay(c: Calendar): Long =
            (c.timeInMillis + c.get(Calendar.ZONE_OFFSET) + c.get(Calendar.DST_OFFSET)) / 86_400_000L
        val target = Calendar.getInstance(brusselsTz).apply { timeInMillis = windowStartTs + startMins * 60_000L }
        val today = Calendar.getInstance(brusselsTz)
        return when (localDay(target) - localDay(today)) {
            -1L -> "Gisteren"
            0L -> "Vandaag"
            1L -> "Morgen"
            else -> "Later"
        }
    }

    fun getStatus(program: ProgramDto, nowMinsSinceWindow: Int): ProgramStatus {
        val endMins = program.startMins + program.durationMins
        return when {
            nowMinsSinceWindow in program.startMins until endMins -> ProgramStatus.LIVE
            nowMinsSinceWindow < program.startMins -> ProgramStatus.UPCOMING
            else -> ProgramStatus.PAST
        }
    }

    fun getProgress(program: ProgramDto, nowMinsSinceWindow: Int): Float {
        if (program.durationMins <= 0) return 0f
        val elapsed = (nowMinsSinceWindow - program.startMins).coerceIn(0, program.durationMins)
        return elapsed.toFloat() / program.durationMins.toFloat()
    }

    fun getRemainingMinutes(program: ProgramDto, nowMinsSinceWindow: Int): Int {
        return (program.startMins + program.durationMins - nowMinsSinceWindow).coerceAtLeast(1)
    }
}

object EpgRepository {
    private val json = Json { ignoreUnknownKeys = true }

    // Verwijs naar je GitHub guide.json of je eigen BEkijk backend-URL
    private const val DEFAULT_GUIDE_URL =
        "https://raw.githubusercontent.com/Mojo2003/BEkijk/main/guide.json"

    suspend fun fetchGuide(url: String = DEFAULT_GUIDE_URL): GuidePayload =
        withContext(Dispatchers.IO) {
            val connection = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = 10_000
                readTimeout = 15_000
                setRequestProperty("User-Agent", "BEkijk-AndroidTV/1.0")
            }
            try {
                val raw = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                json.decodeFromString<GuidePayload>(raw)
            } finally {
                connection.disconnect()
            }
        }
}
