package com.klonos.lagkiller

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import androidx.core.app.NotificationCompat
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer

class LagKillerVpnService : VpnService() {
    
    private var vpnInterface: ParcelFileDescriptor? = null
    private var isRunning = false
    
    // JNI: Rust Core Functions
    private external fun swarmEngineInit(): Long
    private external fun swarmEngineProcess(
        enginePtr: Long, 
        packetData: ByteArray, 
        length: Int
    ): Boolean
    private external fun swarmEngineDestroy(enginePtr: Long)
    
    private var enginePtr: Long = 0
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        enginePtr = swarmEngineInit()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!isRunning) {
            startVPN()
        }
        return START_STICKY
    }
    
    private fun startVPN() {
        val builder = Builder()
            .setSession("LagKiller SWARM")
            .addAddress("10.0.0.2", 24)
            .addRoute("0.0.0.0", 0)
            .addDnsServer("8.8.8.8")
        
        vpnInterface = builder.establish()
        isRunning = true
        
        startForeground(1, createNotification())
        
        Thread {
            processPackets()
        }.start()
    }
    
    private fun processPackets() {
        val inputStream = FileInputStream(vpnInterface!!.fileDescriptor)
        val outputStream = FileOutputStream(vpnInterface!!.fileDescriptor)
        val buffer = ByteBuffer.allocate(32767)
        
        while (isRunning) {
            try {
                val length = inputStream.read(buffer.array())
                if (length > 0) {
                    val shouldDrop = swarmEngineProcess(
                        enginePtr, 
                        buffer.array(), 
                        length
                    )
                    
                    if (!shouldDrop) {
                        outputStream.write(buffer.array(), 0, length)
                    }
                    
                    buffer.clear()
                }
            } catch (e: Exception) {
                e.printStackTrace()
                break
            }
        }
    }
    
    override fun onDestroy() {
        isRunning = false
        vpnInterface?.close()
        swarmEngineDestroy(enginePtr)
        super.onDestroy()
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "lagkiller_channel",
                "LagKiller Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
    
    private fun createNotification() =
        NotificationCompat.Builder(this, "lagkiller_channel")
            .setContentTitle("LagKiller SWARM Activo")
            .setContentText("Motor neuromórfico protegiendo tu tráfico")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .build()
}
