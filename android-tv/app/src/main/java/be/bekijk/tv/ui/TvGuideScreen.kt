package be.bekijk.tv.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.IntOffset
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
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

enum class TvFilter(val label: String) {
    ALL("Alle"),
    VLAAMS("Vlaams"),
    WAALS("Waals")
}

/** Vaste volgorde van de zenders. Onbekende zenders komen achteraan. */
private val ChannelOrder = listOf(
    "vrt1", "canvas", "vtm", "vtm2", "vtm3", "vtm4", "vtmgold",
    "play4", "play5", "play6", "playreality", "playcrime",
    "laune", "rtltvi", "arte"
)

// Vaste afmetingen: een vaste hero-hoogte voorkomt dat het hele scherm verspringt.
private val HeroHeight = 132.dp
private val TileHeight = 60.dp
private val TileVPad = 4.dp

// Eén gedeelde tijdas voor alle zenders: elke minuut is even breed, voor elke zender.
private const val DpPerMin = 4f
private val LabelWidth = 150.dp
private val LabelGap = 16.dp
// Waar de gele "Nu"-lijn staat, gemeten vanaf de linkerkant van de tijdlijn.
private val NowAnchor = 150.dp
// Alleen tegels dicht bij het scherm worden getekend (anders zijn het er duizenden).
private const val CullChunkDp = 400f
private const val CullMarginDp = 700f

private val ColorAccent = Color(0xFFFFD21F)
private val ColorMuted = Color(0xFF94A3B8)

private class ScrollGuard { var on = false }

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

/**
 * Houdt de titel van een breed programma zichtbaar aan de linkerrand terwijl je verder scrolt,
 * zodat je niet naar een lege tegel kijkt.
 */
private fun Modifier.stickyStart(tileLeftPx: Float, minTextPx: Float, scrollPx: () -> Float): Modifier =
    layout { measurable, constraints ->
        val maxShift = (constraints.maxWidth - minTextPx).coerceAtLeast(0f)
        val shift = (scrollPx() - tileLeftPx).coerceIn(0f, maxShift).roundToInt()
        val placeable = measurable.measure(
            Constraints(0, (constraints.maxWidth - shift).coerceAtLeast(0), 0, constraints.maxHeight)
        )
        layout(constraints.maxWidth, constraints.maxHeight) { placeable.place(shift, 0) }
    }

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun TvGuideScreen(
    guide: GuidePayload,
    onRefresh: () -> Unit
) {
    val context = LocalContext.current
    val density = LocalDensity.current.density
    val scope = rememberCoroutineScope()
    var activeFilter by remember { mutableStateOf(TvFilter.ALL) }
    var nowMins by remember(guide) {
        mutableStateOf(EpgTimeHelper.currentMinutesSinceWindow(guide.windowStartHour, guide.windowStartTs))
    }

    LaunchedEffect(guide) {
        while (true) {
            delay(30_000L)
            nowMins = EpgTimeHelper.currentMinutesSinceWindow(guide.windowStartHour, guide.windowStartTs)
        }
    }

    val filteredChannels = remember(guide, activeFilter) {
        val base = when (activeFilter) {
            TvFilter.ALL -> guide.channels
            TvFilter.VLAAMS -> guide.channels.filter { it.category == "vlaams" }
            TvFilter.WAALS -> guide.channels.filter { it.category == "waals" }
        }
        base.sortedBy { ch ->
            val i = ChannelOrder.indexOf(ch.id)
            if (i < 0) Int.MAX_VALUE else i
        }
    }

    var selectedChannel by remember(filteredChannels) { mutableStateOf(filteredChannels.firstOrNull()) }
    var selectedProgram by remember(filteredChannels) {
        mutableStateOf(pickCurrentProgram(filteredChannels.firstOrNull(), nowMins))
    }

    // --- Gedeelde horizontale positie (in pixels) voor alle zenders ---
    val scrollX = remember { Animatable(0f) }
    val scrollPx: () -> Float = remember { { scrollX.value } }
    var viewportPx by remember { mutableIntStateOf(0) }
    var jumpSignal by remember { mutableIntStateOf(0) }
    val guard = remember { ScrollGuard() }

    val totalMins = remember(guide) {
        max(
            600,
            guide.channels.maxOfOrNull { ch -> ch.programs.maxOfOrNull { it.startMins + it.durationMins } ?: 0 } ?: 0
        )
    }
    val maxScroll = max(0f, totalMins * DpPerMin * density - viewportPx)
    val nowTarget = ((nowMins * DpPerMin - NowAnchor.value) * density).coerceIn(0f, maxScroll)
    val nowTargetState = rememberUpdatedState(nowTarget)

    val awayFromNow by remember {
        derivedStateOf { abs(scrollX.value - nowTargetState.value) > 40f * density }
    }

    /** Spring naar "Nu": de tijdlijn staat weer op de huidige tijd en de focus gaat naar het live-programma. */
    fun jumpToNow() {
        scope.launch {
            guard.on = true
            scrollX.snapTo(nowTarget)
            jumpSignal += 1
            delay(500)
            guard.on = false
        }
    }

    // Bij het openen (en bij een nieuwe gids) meteen naar "Nu".
    var initialised by remember(guide) { mutableStateOf(false) }
    LaunchedEffect(guide, viewportPx) {
        if (viewportPx > 0 && !initialised) {
            initialised = true
            jumpToNow()
        }
    }

    val selectedStatus = selectedProgram?.let { EpgTimeHelper.getStatus(it, nowMins) }
    BackHandler(enabled = filteredChannels.isNotEmpty() && (awayFromNow || selectedStatus != ProgramStatus.LIVE)) {
        jumpToNow()
    }

    /** Scroll zo weinig mogelijk, net genoeg om de gefocuste tegel leesbaar in beeld te houden. */
    fun ensureVisible(program: ProgramDto) {
        if (guard.on || viewportPx <= 0) return
        val left = max(0, program.startMins) * DpPerMin * density
        val right = (program.startMins + program.durationMins) * DpPerMin * density
        val need = min(right - left, 220f * density)
        val pad = 24f * density
        val cur = scrollX.value
        val target = when {
            right - cur < need -> left - pad
            left + need > cur + viewportPx -> left + need - viewportPx + pad
            else -> return
        }
        scope.launch { scrollX.animateTo(target.coerceIn(0f, maxScroll), tween(180)) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF081321))
            .padding(horizontal = 36.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Bovenbalk: merknaam + filterknoppen + vernieuwen
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
                        FilterChipButton(
                            label = filter.label,
                            selected = activeFilter == filter,
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

        // Hero-gedeelte voor het geselecteerde programma
        val heroCh = selectedChannel
        val heroProg = selectedProgram
        if (heroCh != null && heroProg != null) {
            val heroIdx = heroCh.programs.indexOf(heroProg)
            val nextProg = if (heroIdx >= 0) heroCh.programs.getOrNull(heroIdx + 1) else null
            ProgramHeroBanner(
                channel = heroCh,
                program = heroProg,
                nextProgram = nextProg,
                nowMins = nowMins,
                onWatchClick = { TvAppLauncher.openChannel(context, heroCh) }
            )
        }

        if (filteredChannels.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "Geen zenders in deze selectie.", color = ColorMuted, fontSize = 16.sp)
            }
        } else {
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                Column(modifier = Modifier.fillMaxSize()) {
                    TimeRuler(
                        windowStartHour = guide.windowStartHour,
                        totalMins = totalMins,
                        scrollPx = scrollPx,
                        onViewportWidth = { viewportPx = it }
                    )
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                        contentPadding = PaddingValues(vertical = 2.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(filteredChannels, key = { it.id }) { channel ->
                            ChannelTimelineRow(
                                channel = channel,
                                nowMins = nowMins,
                                totalMins = totalMins,
                                isSelected = channel.id == selectedChannel?.id,
                                jumpSignal = jumpSignal,
                                scrollPx = scrollPx,
                                viewportPx = viewportPx,
                                onProgramFocused = { prog ->
                                    selectedChannel = channel
                                    selectedProgram = prog
                                    ensureVisible(prog)
                                },
                                onProgramSelected = { TvAppLauncher.openChannel(context, channel) }
                            )
                        }
                    }
                }

                // De gele "Nu"-lijn: staat vast op de huidige tijd, de tegels schuiven eronder door.
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(start = LabelWidth + LabelGap)
                        .drawBehind {
                            val x = nowMins * DpPerMin * density - scrollX.value
                            if (x >= 0f && x <= size.width) {
                                val w = 2.5f * density
                                drawRect(
                                    color = ColorAccent,
                                    topLeft = Offset(x - w / 2f, 0f),
                                    size = androidx.compose.ui.geometry.Size(w, size.height)
                                )
                                val t = 6f * density
                                val tri = Path().apply {
                                    moveTo(x - t, 0f)
                                    lineTo(x + t, 0f)
                                    lineTo(x, t * 1.4f)
                                    close()
                                }
                                drawPath(tri, ColorAccent)
                            }
                        }
                )
            }
        }
    }
}

/** Uren boven de tijdlijn. Meet ook de breedte van het zichtbare tijdvenster. */
@Composable
private fun TimeRuler(
    windowStartHour: Int,
    totalMins: Int,
    scrollPx: () -> Float,
    onViewportWidth: (Int) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(22.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Spacer(modifier = Modifier.width(LabelWidth + LabelGap))
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .clipToBounds()
                .onSizeChanged { onViewportWidth(it.width) }
        ) {
            Box(
                modifier = Modifier
                    .wrapContentWidth(Alignment.Start, unbounded = true)
                    .offset { IntOffset(-scrollPx().roundToInt(), 0) }
                    .width((totalMins * DpPerMin).dp)
                    .fillMaxHeight()
            ) {
                for (k in 0..(totalMins / 60)) {
                    Text(
                        text = "%02d:00".format((windowStartHour + k) % 24),
                        color = ColorMuted,
                        fontSize = 11.sp,
                        maxLines = 1,
                        modifier = Modifier
                            .offset(x = (k * 60 * DpPerMin).dp + 6.dp)
                            .align(Alignment.CenterStart)
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
    totalMins: Int,
    isSelected: Boolean,
    jumpSignal: Int,
    scrollPx: () -> Float,
    viewportPx: Int,
    onProgramFocused: (ProgramDto) -> Unit,
    onProgramSelected: (ProgramDto) -> Unit
) {
    val density = LocalDensity.current.density
    val nowFocus = remember { FocusRequester() }
    val isSelectedState = rememberUpdatedState(isSelected)

    // Na een sprong naar "Nu" krijgt het live-programma van de geselecteerde zender de focus.
    LaunchedEffect(jumpSignal) {
        if (jumpSignal > 0 && isSelectedState.value) {
            repeat(3) { withFrameNanos { } }
            try {
                nowFocus.requestFocus()
            } catch (_: Exception) {
            }
        }
    }

    // Alleen de tegels bij het zichtbare gedeelte worden opgebouwd.
    val chunkPx = CullChunkDp * density
    val chunk by remember { derivedStateOf { (scrollPx() / chunkPx).toInt() } }
    val viewportDp = viewportPx / density
    val visible = remember(channel.programs, chunk, viewportDp) {
        val minDp = chunk * CullChunkDp - CullMarginDp
        val maxDp = (chunk + 1) * CullChunkDp + viewportDp + CullMarginDp
        channel.programs.filter {
            (it.startMins + it.durationMins) * DpPerMin >= minDp && it.startMins * DpPerMin <= maxDp
        }
    }
    val nowProgram = pickCurrentProgram(channel, nowMins)

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(LabelGap)
    ) {
        Column(
            modifier = Modifier.width(LabelWidth),
            verticalArrangement = Arrangement.spacedBy(3.dp)
        ) {
            ChannelBadge(channel)
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

        Box(
            modifier = Modifier
                .weight(1f)
                .height(TileHeight + TileVPad * 2)
                .clipToBounds()
        ) {
            Box(
                modifier = Modifier
                    .wrapContentWidth(Alignment.Start, unbounded = true)
                    .offset { IntOffset(-scrollPx().roundToInt(), 0) }
                    .width((totalMins * DpPerMin).dp)
                    .fillMaxHeight()
            ) {
                visible.forEach { program ->
                    key(program.startMins) {
                        ProgramTile(
                            program = program,
                            nowMins = nowMins,
                            density = density,
                            scrollPx = scrollPx,
                            focusRequester = if (program.startMins == nowProgram?.startMins) nowFocus else null,
                            onFocused = { onProgramFocused(program) },
                            onClick = { onProgramSelected(program) }
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun ProgramTile(
    program: ProgramDto,
    nowMins: Int,
    density: Float,
    scrollPx: () -> Float,
    focusRequester: FocusRequester?,
    onFocused: () -> Unit,
    onClick: () -> Unit
) {
    var focused by remember { mutableStateOf(false) }
    val status = EpgTimeHelper.getStatus(program, nowMins)
    val isLive = status == ProgramStatus.LIVE

    val startMins = max(0, program.startMins)
    val endMins = program.startMins + program.durationMins
    val widthDp = ((endMins - startMins) * DpPerMin - 3f).coerceAtLeast(6f)

    Surface(
        onClick = onClick,
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(10.dp)),
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
            border = Border(BorderStroke(1.dp, if (isLive) Color(0x66FFD21F) else Color(0x1FFFFFFF))),
            focusedBorder = Border(BorderStroke(2.dp, ColorAccent))
        ),
        modifier = Modifier
            .offset(x = (startMins * DpPerMin).dp, y = TileVPad)
            .width(widthDp.dp)
            .height(TileHeight)
            .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
            .onFocusChanged { state ->
                focused = state.isFocused
                if (state.isFocused) onFocused()
            }
    ) {
        Column(
            modifier = Modifier
                .stickyStart(startMins * DpPerMin * density, 90f * density, scrollPx)
                .fillMaxSize()
                .padding(horizontal = 10.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = if (isLive) "NU · ${program.start}" else program.start,
                color = when {
                    focused || isLive -> ColorAccent
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

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun ProgramHeroBanner(
    channel: ChannelDto,
    program: ProgramDto,
    nextProgram: ProgramDto?,
    nowMins: Int,
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
                shape = RoundedCornerShape(16.dp)
            )
            .padding(horizontal = 20.dp, vertical = 10.dp)
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
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(
                        text = "$statusLabel · ${channel.name} · ${program.start} – ${program.end} · ${program.genre}",
                        color = if (status == ProgramStatus.LIVE) ColorAccent else ColorMuted,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = program.title,
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = program.desc,
                        color = Color(0xFFCBD5E1),
                        fontSize = 12.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Vaste hoogte, zodat de balk niet verspringt tussen live en niet-live
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(18.dp),
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
                            Text(text = "Nog $remaining min", color = ColorMuted, fontSize = 12.sp, maxLines = 1)
                        }
                        ProgramStatus.UPCOMING -> {
                            val until = (program.startMins - nowMins).coerceAtLeast(1)
                            Text(text = "Begint over $until min", color = ColorMuted, fontSize = 12.sp, maxLines = 1)
                        }
                        ProgramStatus.PAST -> {
                            Text(text = "Afgelopen", color = Color(0xFF64748B), fontSize = 12.sp, maxLines = 1)
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

            Button(
                onClick = onWatchClick,
                colors = ButtonDefaults.colors(
                    containerColor = ColorAccent,
                    contentColor = Color(0xFF0B0E14)
                )
            ) {
                Text(text = "Kijk via ${channel.app}", fontWeight = FontWeight.SemiBold)
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

