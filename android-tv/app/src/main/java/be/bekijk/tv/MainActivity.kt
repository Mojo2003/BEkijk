package be.bekijk.tv

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Button
import androidx.tv.material3.ButtonDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import androidx.tv.material3.Text
import be.bekijk.tv.data.EpgRepository
import be.bekijk.tv.data.GuidePayload
import be.bekijk.tv.ui.TvGuideScreen
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val prefs = getSharedPreferences("bekijk_tv_prefs", Context.MODE_PRIVATE)
        val initialFavs = prefs.getStringSet("favorite_channels", setOf("vrt1", "canvas", "vtm", "play4"))
            ?: setOf("vrt1", "canvas", "vtm", "play4")

        val initialProgramFavs = prefs.getStringSet("favorite_programs", emptySet<String>())
            ?: emptySet()

        setContent {
            BEkijkTvApp(
                initialFavorites = initialFavs,
                onPersistFavorites = { updated ->
                    prefs.edit().putStringSet("favorite_channels", updated).apply()
                },
                initialFavoritePrograms = initialProgramFavs,
                onPersistFavoritePrograms = { updated ->
                    prefs.edit().putStringSet("favorite_programs", updated).apply()
                }
            )
        }
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun BEkijkTvApp(
    initialFavorites: Set<String>,
    onPersistFavorites: (Set<String>) -> Unit,
    initialFavoritePrograms: Set<String>,
    onPersistFavoritePrograms: (Set<String>) -> Unit
) {
    val scope = rememberCoroutineScope()
    var guide by remember { mutableStateOf<GuidePayload?>(null) }
    var loading by remember { mutableStateOf(true) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var favorites by remember { mutableStateOf(initialFavorites) }
    var favoritePrograms by remember { mutableStateOf(initialFavoritePrograms) }

    fun loadGuide() {
        scope.launch {
            loading = true
            errorMsg = null
            try {
                guide = EpgRepository.fetchGuide()
            } catch (e: Exception) {
                errorMsg = e.message ?: "Kan TV-gids niet ophalen."
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        loadGuide()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0B0E14))
    ) {
        when {
            loading && guide == null -> {
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "BEkijk",
                        color = Color.White,
                        fontSize = 30.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Belgische TV-gids laden...",
                        color = Color(0xFF94A3B8),
                        fontSize = 15.sp
                    )
                }
            }

            errorMsg != null && guide == null -> {
                Column(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Kon de TV-gids niet laden",
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = errorMsg.orEmpty(),
                        color = Color(0xFF94A3B8),
                        fontSize = 14.sp
                    )
                    Button(
                        onClick = { loadGuide() },
                        colors = ButtonDefaults.colors(
                            containerColor = Color(0xFFF59E0B),
                            contentColor = Color(0xFF0B0E14)
                        )
                    ) {
                        Text(text = "Opnieuw proberen", fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            guide != null -> {
                TvGuideScreen(
                    guide = guide!!,
                    favorites = favorites,
                    onToggleFavorite = { channelId ->
                        val next = if (favorites.contains(channelId)) {
                            favorites - channelId
                        } else {
                            favorites + channelId
                        }
                        favorites = next
                        onPersistFavorites(next)
                    },
                    favoritePrograms = favoritePrograms,
                    onToggleFavoriteProgram = { key ->
                        val next = if (favoritePrograms.contains(key)) {
                            favoritePrograms - key
                        } else {
                            favoritePrograms + key
                        }
                        favoritePrograms = next
                        onPersistFavoritePrograms(next)
                    },
                    onRefresh = { loadGuide() }
                )
            }
        }
    }
}
