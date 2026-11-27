package be.bekijk.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Button
import androidx.tv.material3.ButtonDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import androidx.tv.material3.Text
import be.bekijk.tv.R
import be.bekijk.tv.data.EpgRepository
import be.bekijk.tv.data.GuidePayload
import be.bekijk.tv.ui.TvGuideScreen
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            BEkijkTvApp()
        }
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun BEkijkTvApp() {
    val scope = rememberCoroutineScope()
    var guide by remember { mutableStateOf<GuidePayload?>(null) }
    var loading by remember { mutableStateOf(true) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

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
            .background(Color(0xFF081321))
    ) {
        when {
            loading && guide == null -> {
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.bekijk_logo),
                        contentDescription = "BEkijk",
                        modifier = Modifier.size(width = 300.dp, height = 105.dp)
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
                            containerColor = Color(0xFFFFD21F),
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
                    onRefresh = { loadGuide() }
                )
            }
        }
    }
}
