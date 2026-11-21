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
import be.bekijk.tv.launcher.TvAppLauncher
import kotlinx.coroutines.delay

enum class TvFilter(val label: String) {
    ALL("Alle"),
    VLAAMS("Vlaams"),
    WAALS("Waals"),
    FAVORITES("Favorieten")
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun TvGuideScreen(
    guide: GuidePayload,
    favorites: Set<String>,
    onToggleFavorite: (String) -> Unit,
    onRefresh: () -> Unit
) {
    val context = LocalContext.current
    var activeFilter by remember { mutableStateOf(TvFilter.ALL) }
    var nowMins by remember(guide) { mutableStateOf(EpgTimeHelper.currentMinutesSinceWindow(guide.windowStartHour)) }

    LaunchedEffect(guide) {
        while (true) {
            delay(60_000L)
            nowMins = EpgTimeHelper.currentMinutesSinceWindow(guide.windowStartHour)
        }
    }

    val filteredChannels = remember(guide, activeFilter, favorites) {
        val base = when (activeFilter) {
            TvFilter.ALL -> guide.channels
            TvFilter.VLAAMS -> guide.channels.filter { it.category == "vlaams" }
            TvFilter.WAALS -> guide.channels.filter { it.category == "waals" }
            TvFilter.FAVORITES -> guide.channels.filter { favorites.contains(it.id) }
        }
        base.sortedBy { if (favorites.contains(it.id)) 0 else 1 }
    }

    var selectedChannel by remember(filteredChannels) { mutableStateOf(filteredChannels.firstOrNull()) }
    var selectedProgram by remember(filteredChannels) {
        val firstCh = filteredChannels.firstOrNull()
        val liveProg = firstCh?.programs?.firstOrNull {
            EpgTimeHelper.getStatus(it, nowMins) == ProgramStatus.LIVE
        }
        mutableStateOf(liveProg ?: firstCh?.programs?.firstOrNull())
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0B0E14))
            .padding(horizontal = 36.dp, vertical = 22.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
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
                    color = Color(0xFF94A3B8),
                    fontSize = 12.sp
                )
                OutlinedButton(onClick = onRefresh) {
                    Text(text = "Vernieuwen", fontSize = 13.sp)
                }
            }
        }

        // Hero-gedeelte voor de geselecteerde tijdsbalk
        val heroCh = selectedChannel
        val heroProg = selectedProgram
        if (heroCh != null && heroProg != null) {
            ProgramHeroBanner(
                channel = heroCh,
                program = heroProg,
                nowMins = nowMins,
                isFavorite = favorites.contains(heroCh.id),
                onToggleFavorite = { onToggleFavorite(heroCh.id) },
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
                    text = "Geen zenders in deze selectie.",
                    color = Color(0xFF94A3B8),
                    fontSize = 16.sp
                )
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(filteredChannels, key = { it.id }) { channel ->
                    ChannelTimelineRow(
                        channel = channel,
                        nowMins = nowMins,
                        isFavorite = favorites.contains(channel.id),
                        onProgramFocused = { prog ->
                            selectedChannel = channel
                            selectedProgram = prog
                        },
                        onProgramSelected = {
                            TvAppLauncher.openChannel(context, channel)
                        }
                    )
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
            containerColor = if (selected) Color(0xFFF59E0B) else Color(0xFF161C28),
            contentColor = if (selected) Color(0xFF0B0E14) else Color(0xFFCBD5E1),
            focusedContainerColor = if (selected) Color(0xFFFBBF24) else Color(0xFF222B3E),
            focusedContentColor = if (selected) Color(0xFF0B0E14) else Color.White
        ),
        border = ClickableSurfaceDefaults.border(
            border = Border(BorderStroke(1.dp, Color(0x18FFFFFF))),
            focusedBorder = Border(BorderStroke(2.dp, Color(0xFFF59E0B)))
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

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun ProgramHeroBanner(
    channel: ChannelDto,
    program: ProgramDto,
    nowMins: Int,
    isFavorite: Boolean,
    onToggleFavorite: () -> Unit,
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
            .background(
                brush = Brush.horizontalGradient(
                    colors = listOf(Color(0xFF131822), Color(0xFF1C2435))
                ),
                shape = RoundedCornerShape(18.dp)
            )
            .padding(22.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(end = 24.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "$statusLabel · ${channel.name} · ${program.start} – ${program.end} · ${program.genre}",
                    color = if (status == ProgramStatus.LIVE) Color(0xFFF59E0B) else Color(0xFF94A3B8),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = program.title,
                    color = Color.White,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = program.desc,
                    color = Color(0xFFCBD5E1),
                    fontSize = 14.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                if (status == ProgramStatus.LIVE) {
                    val progress = EpgTimeHelper.getProgress(program, nowMins)
                    val remaining = EpgTimeHelper.getRemainingMinutes(program, nowMins)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.padding(top = 4.dp)
                    ) {
                        LinearProgressIndicator(
                            progress = { progress },
                            color = Color(0xFFF59E0B),
                            trackColor = Color(0xFF263044),
                            modifier = Modifier
                                .width(220.dp)
                                .height(5.dp)
                        )
                        Text(
                            text = "Nog $remaining min · ${channel.app}",
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp
                        )
                    }
                }
            }

            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                horizontalAlignment = Alignment.End
            ) {
                Button(
                    onClick = onWatchClick,
                    colors = ButtonDefaults.colors(
                        containerColor = Color(0xFFF59E0B),
                        contentColor = Color(0xFF0B0E14)
                    )
                ) {
                    Text(
                        text = "Kijk via ${channel.app}",
                        fontWeight = FontWeight.SemiBold
                    )
                }

                OutlinedButton(onClick = onToggleFavorite) {
                    Text(
                        text = if (isFavorite) "Favoriet ★" else "Zet bij favorieten",
                        fontSize = 12.sp
                    )
                }
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
    onProgramFocused: (ProgramDto) -> Unit,
    onProgramSelected: (ProgramDto) -> Unit
) {
    val rowState = rememberLazyListState()

    LaunchedEffect(channel.id, nowMins) {
        val liveIdx = channel.programs.indexOfFirst {
            EpgTimeHelper.getStatus(it, nowMins) == ProgramStatus.LIVE
        }
        if (liveIdx > 0) {
            rowState.scrollToItem(liveIdx)
        }
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Column(modifier = Modifier.width(156.dp)) {
            Text(
                text = if (isFavorite) "${channel.name} ★" else channel.name,
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = channel.app,
                color = Color(0xFF94A3B8),
                fontSize = 12.sp
            )
        }

        LazyRow(
            state = rowState,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(channel.programs) { program ->
                var focused by remember { mutableStateOf(false) }
                val status = EpgTimeHelper.getStatus(program, nowMins)
                val isLive = status == ProgramStatus.LIVE

                Surface(
                    onClick = { onProgramSelected(program) },
                    shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(12.dp)),
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
                                if (isLive) Color(0x66F59E0B) else Color(0x1FFFFFFF)
                            )
                        ),
                        focusedBorder = Border(BorderStroke(2.dp, Color(0xFFF59E0B)))
                    ),
                    modifier = Modifier
                        .width((program.durationMins.coerceIn(30, 180) * 3.4f).dp)
                        .height(78.dp)
                        .onFocusChanged { state ->
                            focused = state.isFocused
                            if (state.isFocused) onProgramFocused(program)
                        }
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = if (isLive) "NU · ${program.start}" else program.start,
                            color = when {
                                focused || isLive -> Color(0xFFF59E0B)
                                status == ProgramStatus.PAST -> Color(0xFF64748B)
                                else -> Color(0xFF94A3B8)
                            },
                            fontSize = 12.sp,
                            fontWeight = if (isLive) FontWeight.SemiBold else FontWeight.Normal
                        )
                        Text(
                            text = program.title,
                            color = if (status == ProgramStatus.PAST && !focused) Color(0xFF94A3B8) else Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}
