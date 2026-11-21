package be.bekijk.tv.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
import be.bekijk.tv.data.GuidePayload
import be.bekijk.tv.data.ProgramDto
import be.bekijk.tv.launcher.TvAppLauncher

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun TvGuideScreen(guide: GuidePayload) {
    val context = LocalContext.current
    var selectedChannel by remember(guide) { mutableStateOf(guide.channels.firstOrNull()) }
    var selectedProgram by remember(guide) {
        mutableStateOf(guide.channels.firstOrNull()?.programs?.firstOrNull())
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0B0E14))
            .padding(horizontal = 40.dp, vertical = 28.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        // Hero-gedeelte voor de geselecteerde tijdsbalk
        selectedChannel?.let { channel ->
            selectedProgram?.let { program ->
                ProgramHeroBanner(
                    channel = channel,
                    program = program,
                    onWatchClick = { TvAppLauncher.openChannel(context, channel) }
                )
            }
        }

        // Horizontale tijdlijn per zender met D-pad focus
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(18.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(guide.channels, key = { it.id }) { channel ->
                ChannelTimelineRow(
                    channel = channel,
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

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun ProgramHeroBanner(
    channel: ChannelDto,
    program: ProgramDto,
    onWatchClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                brush = Brush.horizontalGradient(
                    colors = listOf(Color(0xFF131822), Color(0xFF1A2233))
                ),
                shape = RoundedCornerShape(18.dp)
            )
            .padding(24.dp)
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
                    text = "${channel.name} · ${program.start} – ${program.end} · ${program.genre}",
                    color = Color(0xFFF59E0B),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = program.title,
                    color = Color.White,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = program.desc,
                    color = Color(0xFFCBD5E1),
                    fontSize = 15.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

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
        }
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun ChannelTimelineRow(
    channel: ChannelDto,
    onProgramFocused: (ProgramDto) -> Unit,
    onProgramSelected: (ProgramDto) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Column(modifier = Modifier.width(150.dp)) {
            Text(
                text = channel.name,
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = channel.app,
                color = Color(0xFF94A3B8),
                fontSize = 12.sp
            )
        }

        LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            items(channel.programs) { program ->
                var focused by remember { mutableStateOf(false) }
                Surface(
                    onClick = { onProgramSelected(program) },
                    shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(12.dp)),
                    colors = ClickableSurfaceDefaults.colors(
                        containerColor = Color(0xFF161C28),
                        focusedContainerColor = Color(0xFF222B3E)
                    ),
                    border = ClickableSurfaceDefaults.border(
                        border = Border(BorderStroke(1.dp, Color(0x1FFFFFFF))),
                        focusedBorder = Border(BorderStroke(2.dp, Color(0xFFF59E0B)))
                    ),
                    modifier = Modifier
                        .width((program.durationMins.coerceIn(30, 180) * 3.2f).dp)
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
                            text = program.start,
                            color = if (focused) Color(0xFFF59E0B) else Color(0xFF94A3B8),
                            fontSize = 12.sp
                        )
                        Text(
                            text = program.title,
                            color = Color.White,
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
