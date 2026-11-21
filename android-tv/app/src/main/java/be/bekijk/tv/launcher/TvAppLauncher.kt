package be.bekijk.tv.launcher

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import be.bekijk.tv.data.ChannelDto

object TvAppLauncher {

    private val FALLBACK_PACKAGES = mapOf(
        "VRT MAX" to "be.vrt.vrtnu",
        "VTM GO" to "be.vmma.vtm.zenderapp",
        "GoPlay" to "be.goplay.app",
        "RTBF Auvio" to "be.rtbf.auvio",
        "RTL play" to "com.tapptic.rtl.tvi",
        "ARTE" to "tv.arte.plus7",
        "NPO Start" to "nl.uitzendinggemist"
    )

    fun openChannel(context: Context, channel: ChannelDto) {
        val pkg = channel.androidPackage.ifBlank { FALLBACK_PACKAGES[channel.app].orEmpty() }

        // 1. Probeer rechtstreeks de livestream deep-link te openen in de Android TV-app
        if (pkg.isNotBlank() && channel.deepLink.isNotBlank()) {
            val deepIntent = Intent(Intent.ACTION_VIEW, Uri.parse(channel.deepLink)).apply {
                setPackage(pkg)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (tryStart(context, deepIntent)) return
        }

        // 2. Fallback: open het hoofdscherm van de TV-app via Leanback of standaard launcher
        if (pkg.isNotBlank()) {
            val pm = context.packageManager
            val leanbackIntent = pm.getLeanbackLaunchIntentForPackage(pkg)
                ?: pm.getLaunchIntentForPackage(pkg)
            if (leanbackIntent != null) {
                leanbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (tryStart(context, leanbackIntent)) return
            }

            // 3. App nog niet geinstalleerd -> open Google Play Store op Android TV
            val marketIntent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (tryStart(context, marketIntent)) return
        }

        // 4. Laatste fallback: open web-URL in browser
        val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse(channel.deepLink)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        tryStart(context, webIntent)
    }

    private fun tryStart(context: Context, intent: Intent): Boolean {
        return try {
            context.startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            false
        } catch (_: SecurityException) {
            false
        }
    }
}
