package be.bekijk.tv.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.net.URL

@Serializable
data class GuidePayload(
    val updatedAt: String,
    val windowStartHour: Int = 6,
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

object EpgRepository {
    private val json = Json { ignoreUnknownKeys = true }

    // Verwijs naar je GitHub guide.json of je eigen BEkijk backend-URL
    private const val DEFAULT_GUIDE_URL =
        "https://raw.githubusercontent.com/Mojo2003/KijkBE/main/guide.json"

    suspend fun fetchGuide(url: String = DEFAULT_GUIDE_URL): GuidePayload =
        withContext(Dispatchers.IO) {
            val raw = URL(url).readText(Charsets.UTF_8)
            json.decodeFromString<GuidePayload>(raw)
        }
}
