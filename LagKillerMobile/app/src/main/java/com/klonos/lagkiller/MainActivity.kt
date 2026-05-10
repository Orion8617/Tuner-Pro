package com.klonos.lagkiller

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private val VPN_REQUEST_CODE = 1001
    
    private lateinit var statusText: TextView
    private lateinit var toggleButton: Button
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        statusText = findViewById(R.id.statusText)
        toggleButton = findViewById(R.id.toggleButton)
        
        // Cargar librería nativa Rust
        System.loadLibrary("clonengine_snn")
        
        toggleButton.setOnClickListener {
            val intent = VpnService.prepare(this)
            if (intent != null) {
                startActivityForResult(intent, VPN_REQUEST_CODE)
            } else {
                startVpnService()
            }
        }
        
        updateStatus()
    }
    
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == VPN_REQUEST_CODE && resultCode == Activity.RESULT_OK) {
            startVpnService()
        }
    }
    
    private fun startVpnService() {
        val intent = Intent(this, LagKillerVpnService::class.java)
        startService(intent)
        statusText.text = "🔥 SWARM ACTIVADO"
        toggleButton.text = "Detener"
    }
    
    private fun updateStatus() {
        statusText.text = "Sistema SWARM Inactivo"
    }
}
