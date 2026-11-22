package be.bekijk.tv.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.*
import be.bekijk.tv.data.ChannelDto
import be.bekijk.tv.data.EpgTimeHelper
import be.bekijk.tv.data.GuidePayload
import be.bekijk.tv.data.ProgramDto
import be.bekijk.tv.data.ProgramStatus
import be.bekijk.tv.data.programFavoriteKey
import be.bekijk.tv.launcher.TvAppLauncher
import kotlinx.coroutines.delay

enum class TvFilter(val label: String) {
    ALL("Alle"),
    VLAAMS("Vlaams"),
    WAALS("Waals"),
    FAVORITE_CHANNELS("★ Zenders"),
    FAVORITE_PROGRAMS("★ Programma's")
}

// Vaste afmetingen: een vaste hero-hoogte voorkomt dat het hele scherm verspringt
// wanneer je naar een programma met een kortere of langere beschrijving gaat.
private val HeroHeight = 176.dp
private val TileHeight = 72.dp

private val ColorAccent = Color(0xFFFFD21F)
private val ColorMuted = Color(0xFF94A3B8)

/** Een uitzending van een favoriet programma, voor de lijst "★ Programma's". */
private data class FavoriteAiring(val channel: ChannelDto, val program: ProgramDto)

/** Eerste programma dat nog bezig is of nog komt; anders het laatste van de dag. */
private fun pickCurrentProgram(channel: ChannelDto?, nowMins: Int): ProgramDto? {
    val programs = channel?.programs ?: return null
    return programs.firstOrNull { EpgTimeHelper.getStatus(it, nowMins) != ProgramStatus.PAST }
        ?: programs.lastOrNull()
}

/** "#RRGGBB" naar Color, met een neutrale kleur als terugval. */
private fun parseAccent(hex: String): Color {
    val clean = hex.removePrefix("#")
    val rgb = clean.toLongOrNull(16)
    return if (clean.length == 6 && rgb != null) Color(0xFF000000L or rgb) else ColorMuted
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun TvGuideScreen(
    guide: GuidePayload,
    favorites: Set<String>,
    onToggleFavorite: (String) -> Unit,
    favoritePrograms: Set<String>,
    onToggleFavoriteProgram: (String) -> Unit,
    onRefresh: () -> Unit
) {
    val context = LocalContext.current
    var activeFilter by remember { mutableStateOf(TvFilter.ALL) }
    var nowMins by remember(guide) {
        mutableStateOf(EpgTimeHelper.currentMinutesSinceWindow(guide.windowStartHour, guide.windowStartTs))
    }

    LaunchedEffect(guide) {
        while (true) {
            delay(60_000L)
            nowMins = EpgTimeHelper.currentMinutesSinceWindow(guide.windowStartHour, guide.windowStartTs)
        }
    }

    // Sortering en filter gebruiken een momentopname van de favorieten. Zo springt de
    // lijst niet door en blijft je focus staan wanneer je iets (de)selecteert.
    val favoritesForLayout = remember(guide, activeFilter) { favorites }
    val favoriteProgramsForLayout = remember(guide, activeFilter) { favoritePrograms }

    val filteredChannels = remember(guide, activeFilter, favoritesForLayout) {
        val base = when (activeFilter) {
            TvFilter.ALL, TvFilter.FAVORITE_PROGRAMS -> guide.channels
            TvFilter.VLAAMS -> guide.channels.filter { it.category == "vlaams" }
            TvFilter.WAALS -> guide.channels.filter { it.category == "waals" }
            TvFilter.FAVORITE_CHANNELS -> guide.channels.filter { favoritesForLayout.contains(it.id) }
        }
        base.sortedBy { if (favoritesForLayout.contains(it.id)) 0 else 1 }
    }

    val favoriteAirings = remember(guide, favoriteProgramsForLayout, nowMins) {
        guide.channels
            .flatMap { channel ->
                channel.programs
                    .filter {
                        favoriteProgramsForLayout.contains(programFavoriteKey(it.title)) &&
                            EpgTimeHelper.getStatus(it, nowMins) != ProgramStatus.PAST
                    }
                    .map { FavoriteAiring(channel, it) }
            }
            .sortedBy { it.program.startMins }
    }

    var selectedChannel by remember(filteredChannels) { mutableStateOf(filteredChannels.firstOrNull()) }
    var selectedProgram by remember(filteredChannels) {
        mutableStateOf(pickCurrentProgram(filteredChannels.firstOrNull(), nowMins))
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF081321))
            .padding(horizontal = 36.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Bovenbalk: Merknaam + Filterknoppen + Vernieuwen
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                Text(
                    text = "BEkijk",
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TvFilter.entries.forEach { filter ->
                        val isSelected = activeFilter == filter
                        FilterChipButton(
                            label = filter.label,
                            selected = isSelected,
                            onClick = { activeFilter = filter }
                        )
                    }
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "Bijgewerkt ${guide.updatedAt}",
                    color = ColorMuted,
                    fontSize = 12.sp
                )
                SecondaryButton(label = "Vernieuwen", onClick = onRefresh)
            }
        }

        if (activeFilter == TvFilter.FAVORITE_PROGRAMS) {
            FavoriteProgramsList(
                airings = favoriteAirings,
                windowStartTs = guide.windowStartTs,
                favoritePrograms = favoritePrograms,
                onOpen = { channel -> TvAppLauncher.openChannel(context, channel) },
                onToggleFavoriteProgram = onToggleFavoriteProgram
            )
        } else {
            // Hero-gedeelte voor het geselecteerde programma
            val heroCh = selectedChannel
            val heroProg = selectedProgram
            if (heroCh != null && heroProg != null) {
                val heroIdx = heroCh.programs.indexOf(heroProg)
                val nextProg = if (heroIdx >= 0) heroCh.programs.getOrNull(heroIdx + 1) else null
                val heroKey = programFavoriteKey(heroProg.title)
                ProgramHeroBanner(
                    channel = heroCh,
                    program = heroProg,
                    nextProgram = nextProg,
                    nowMins = nowMins,
                    isFavoriteChannel = favorites.contains(heroCh.id),
                    isFavoriteProgram = favoritePrograms.contains(heroKey),
                    onToggleFavoriteChannel = { onToggleFavorite(heroCh.id) },
                    onToggleFavoriteProgram = { onToggleFavoriteProgram(heroKey) },
                    onWatchClick = { TvAppLauncher.openChannel(context, heroCh) }
                )
            }

            // Horizontale tijdlijn per zender met D-pad focus
            if (filteredChannels.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (activeFilter == TvFilter.FAVORITE_CHANNELS) {
                            "Nog geen favoriete zenders. Kies bij een programma 'Zender favoriet'."
                        } else {
                            "Geen zenders in deze selectie."
                        },
                        color = ColorMuted,
                        fontSize = 16.sp
                    )
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    // Ruimte voor de gefocuste tegel, anders wordt die afgeknipt
                    contentPadding = PaddingValues(vertical = 6.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(filteredChannels, key = { it.id }) { channel ->
                        ChannelTimelineRow(
                            channel = channel,
                            nowMins = nowMins,
                            isFavorite = favorites.contains(channel.id),
                            favoritePrograms = favoritePrograms,
                            onProgramFocused = { prog ->
                                selectedChannel = channel
                                selectedProgram = prog
                            },
                            onProgramSelected = {
                                TvAppLauncher.openChannel(context, channel)
                            },
                            onProgramLongClick = { prog ->
                                onToggleFavoriteProgram(programFavoriteKey(prog.title))
                            }
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun FilterChipButton(
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(10.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (selected) ColorAccent else Color(0xFF161C28),
            contentColor = if (selected) Color(0xFF0B0E14) else Color(0xFFCBD5E1),
            focusedContainerColor = if (selected) Color(0xFFFFDE5C) else Color(0xFF222B3E),
            focusedContentColor = if (selected) Color(0xFF0B0E14) else Color.White
        ),
        border = ClickableSurfaceDefaults.border(
            border = Border(BorderStroke(1.dp, Color(0x18FFFFFF))),
            focusedBorder = Border(BorderStroke(2.dp, ColorAccent))
        )
    ) {
        Text(
            text = label,
            fontSize = 13.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
        )
    }
}

/** Knop met goed leesbare tekst (de standaard OutlinedButton was donker op donker). */
@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun SecondaryButton(
    label: String,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.colors(
            containerColor = Color(0xFF263044),
            contentColor = Color(0xFFE2E8F0),
            focusedContainerColor = Color(0xFF3B4A66),
            focusedContentColor = Color.White
        )
    ) {
        Text(text = label, fontSize = 12.sp)
    }
}

/** Zenderbadge: korte naam op de kleur van de zender. (Geen echt logo, wel herkenbaar.) */
@Composable
private fun ChannelBadge(channel: ChannelDto) {
    val accent = parseAccent(channel.accentColor)
    val label = channel.shortName.ifBlank { channel.name }
    Box(
        modifier = Modifier
            .background(accent.copy(alpha = 0.18f), RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = accent,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1
        )
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun ProgramHeroBanner(
    channel: ChannelDto,
    program: ProgramDto,
    nextProgram: ProgramDto?,
    nowMins: Int,
    isFavoriteChannel: Boolean,
    isFavoriteProgram: Boolean,
    onToggleFavoriteChannel: () -> Unit,
    onToggleFavoriteProgram: () -> Unit,
    onWatchClick: () -> Unit
) {
    val status = EpgTimeHelper.getStatus(program, nowMins)
    val statusLabel = when (status) {
        ProgramStatus.LIVE -> "NU LIVE"
        ProgramStatus.UPCOMING -> "BINNENKORT"
        ProgramStatus.PAST -> "AFGELOPEN"
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(HeroHeight)
            .background(
                brush = Brush.horizontalGradient(
                    colors = listOf(Color(0xFF131822), Color(0xFF1C2435))
                ),
                shape = RoundedCornerShape(18.dp)
            )
            .padding(horizontal = 22.dp, vertical = 14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .padding(end = 24.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "$statusLabel · ${channel.name} · ${program.start} – ${program.end} · ${program.genre}",
                        color = if (status == ProgramStatus.LIVE) ColorAccent else ColorMuted,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = if (isFavoriteProgram) "★ ${program.title}" else program.title,
                        color = Color.White,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = program.desc,
                        color = Color(0xFFCBD5E1),
                        fontSize = 13.sp,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Vaste hoogte, zodat de balk niet verspringt tussen live en niet-live
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    when (status) {
                        ProgramStatus.LIVE -> {
                            val progress = EpgTimeHelper.getProgress(program, nowMins)
                            val remaining = EpgTimeHelper.getRemainingMinutes(program, nowMins)
                            LinearProgressIndicator(
                                progress = { progress },
                                color = ColorAccent,
                                trackColor = Color(0xFF263044),
                                modifier = Modifier
                                    .width(140.dp)
                                    .height(5.dp)
                            )
                            Text(
                                text = "Nog $remaining min",
                                color = ColorMuted,
                                fontSize = 12.sp,
                                maxLines = 1
                            )
                        }
                        ProgramStatus.UPCOMING -> {
                            val until = (program.startMins - nowMins).coerceAtLeast(1)
                            Text(
                                text = "Begint over $until min",
                                color = ColorMuted,
                                fontSize = 12.sp,
                                maxLines = 1
                            )
                        }
                        ProgramStatus.PAST -> {
                            Text(
                                text = "Afgelopen",
                                color = Color(0xFF64748B),
                                fontSize = 12.sp,
                                maxLines = 1
                            )
                        }
                    }
                    if (nextProgram != null) {
                        Text(
                            text = "· Daarna: ${nextProgram.title} (${nextProgram.start})",
                            color = ColorMuted,
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false)
                        )
                    }
                }
            }

            Column(
                verticalArrangement = Arrangement.spacedBy(6.dp),
                horizontalAlignment = Alignment.End
            ) {
                Button(
                    onClick = onWatchClick,
                    colors = ButtonDefaults.colors(
                        containerColor = ColorAccent,
                        contentColor = Color(0xFF0B0E14)
                    )
                ) {
                    Text(
                        text = "Kijk via ${channel.app}",
                        fontWeight = FontWeight.SemiBold
                    )
                }

                SecondaryButton(
                    label = if (isFavoriteProgram) "Programma ★" else "Programma volgen",
                    onClick = onToggleFavoriteProgram
                )

                SecondaryButton(
                    label = if (isFavoriteChannel) "Zender ★" else "Zender favoriet",
                    onClick = onToggleFavoriteChannel
                )
            }
        }
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun ChannelTimelineRow(
    channel: ChannelDto,
    nowMins: Int,
    isFavorite: Boolean,
    favoritePrograms: Set<String>,
    onProgramFocused: (ProgramDto) -> Unit,
    onProgramSelected: (ProgramDto) -> Unit,
    onProgramLongClick: (ProgramDto) -> Unit
) {
    val rowState = rememberLazyListState()

    // Alleen bij het openen (en bij een nieuwe gids) naar 'nu' scrollen. Voorheen gebeurde dit
    // elke minuut, waardoor de rij terugsprong terwijl je door de gids navigeerde.
    LaunchedEffect(channel.programs) {
        val idx = channel.programs.indexOfFirst {
            EpgTimeHelper.getStatus(it, nowMins) != ProgramStatus.PAST
        }
        val target = if (idx >= 0) idx else channel.programs.lastIndex
        if (target > 0) {
            rowState.scrollToItem(target)
        }
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Column(
            modifier = Modifier.width(150.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                ChannelBadge(channel)
                if (isFavorite) {
                    Text(text = "★", color = ColorAccent, fontSize = 14.sp)
                }
            }
            Text(
                text = channel.name,
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = channel.app,
                color = ColorMuted,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        LazyRow(
            state = rowState,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            // Ruimte rond de tegels voor de focus-rand en -vergroting
            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 6.dp)
        ) {
            items(channel.programs) { program ->
                var focused by remember { mutableStateOf(false) }
                val status = EpgTimeHelper.getStatus(program, nowMins)
                val isLive = status == ProgramStatus.LIVE
                val isFavoriteProgram = favoritePrograms.contains(programFavoriteKey(program.title))

                Surface(
                    onClick = { onProgramSelected(program) },
                    onLongClick = { onProgramLongClick(program) },
                    shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(12.dp)),
                    scale = ClickableSurfaceDefaults.scale(focusedScale = 1.03f),
                    colors = ClickableSurfaceDefaults.colors(
                        containerColor = when {
                            isLive -> Color(0xFF1D2434)
                            status == ProgramStatus.PAST -> Color(0xFF10141E)
                            else -> Color(0xFF161C28)
                        },
                        focusedContainerColor = Color(0xFF222B3E)
                    ),
                    border = ClickableSurfaceDefaults.border(
                        border = Border(
                            BorderStroke(
                                1.dp,
                                when {
                                    isFavoriteProgram -> Color(0xAAFFD21F)
                                    isLive -> Color(0x66FFD21F)
                                    else -> Color(0x1FFFFFFF)
                                }
                            )
                        ),
                        focusedBorder = Border(BorderStroke(2.dp, ColorAccent))
                    ),
                    modifier = Modifier
                        // Breedte ~ duur, maar nooit smaller dan nodig om een titel te lezen
                        .width((program.durationMins * 3.2f).coerceIn(150f, 520f).dp)
                        .height(TileHeight)
                        .onFocusChanged { state ->
                            focused = state.isFocused
                            if (state.isFocused) onProgramFocused(program)
                        }
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        val timeText = if (isLive) "NU · ${program.start}" else program.start
                        Text(
                            text = if (isFavoriteProgram) "★ $timeText" else timeText,
                            color = when {
                                focused || isLive || isFavoriteProgram -> ColorAccent
                                status == ProgramStatus.PAST -> Color(0xFF64748B)
                                else -> ColorMuted
                            },
                            fontSize = 12.sp,
                            fontWeight = if (isLive) FontWeight.SemiBold else FontWeight.Normal,
                            maxLines = 1
                        )
                        Text(
                            text = program.title,
                            color = if (status == ProgramStatus.PAST && !focused) ColorMuted else Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}

/** Lijst van alle komende uitzendingen van je favoriete programma's, over alle zenders heen. */
@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun FavoriteProgramsList(
    airings: List<FavoriteAiring>,
    windowStartTs: Long,
    favoritePrograms: Set<String>,
    onOpen: (ChannelDto) -> Unit,
    onToggleFavoriteProgram: (String) -> Unit
) {
    if (airings.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "Geen komende uitzendingen van favoriete programma's.\n" +
                    "Houd OK ingedrukt op een programma om het te volgen.",
                color = ColorMuted,
                fontSize = 16.sp
            )
        }
        return
    }

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(vertical = 6.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        items(airings, key = { "${it.channel.id}-${it.program.startMins}" }) { airing ->
            val program = airing.program
            val key = programFavoriteKey(program.title)
            val isFavorite = favoritePrograms.contains(key)

            Surface(
                onClick = { onOpen(airing.channel) },
                onLongClick = { onToggleFavoriteProgram(key) },
                shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(12.dp)),
                scale = ClickableSurfaceDefaults.scale(focusedScale = 1.02f),
                colors = ClickableSurfaceDefaults.colors(
                    containerColor = Color(0xFF161C28),
                    focusedContainerColor = Color(0xFF222B3E)
                ),
                border = ClickableSurfaceDefaults.border(
                    border = Border(BorderStroke(1.dp, Color(0x1FFFFFFF))),
                    focusedBorder = Border(BorderStroke(2.dp, ColorAccent))
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Column(modifier = Modifier.width(110.dp)) {
                        Text(
                            text = EpgTimeHelper.dayLabel(windowStartTs, program.startMins),
                            color = ColorMuted,
                            fontSize = 11.sp,
                            maxLines = 1
                        )
                        Text(
                            text = "${program.start} – ${program.end}",
                            color = ColorAccent,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1
                        )
                    }
                    ChannelBadge(airing.channel)
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = program.title,
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = "${airing.channel.name} · ${program.genre}",
                            color = ColorMuted,
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    Text(
                        text = "★",
                        color = if (isFavorite) ColorAccent else Color(0xFF475569),
                        fontSize = 16.sp
                    )
                }
            }
        }
    }
}
