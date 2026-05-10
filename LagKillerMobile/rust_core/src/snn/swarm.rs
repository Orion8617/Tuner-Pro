//! ClonEngine SWARM — Motor Bio-Cibernético para Limpieza de Paquetes
//! Basado en arquitectura Maya: Vigesimal, 6-bit Archetypes, Schumann Resonance

const VIGESIMAL_WEIGHT: f32 = 1.0 / 9.5;
const PASCAL_4: [f32; 5] = [0.0625, 0.250, 0.375, 0.250, 0.0625];
const WINIK_CYCLE: u32 = 20;
const SCHUMANN_BASE_MS: f32 = 127.713; // 7.83 Hz

#[derive(Debug, Clone)]
pub struct SwarmState {
    pub threshold: f32,
    pub dopamine: f32,
    pub winik_cycle: u32,
    pub cleaned_total: u64,
    pub schumann_phase: f32,
    pub packet_history: [u8; 256],
    pub history_idx: usize,
}

pub struct SwarmEngine {
    state: SwarmState,
    tick_count: u64,
}

impl SwarmEngine {
    pub fn new() -> Self {
        SwarmEngine {
            state: SwarmState {
                threshold: 0.5,
                dopamine: 0.5,
                winik_cycle: 0,
                cleaned_total: 0,
                schumann_phase: 0.0,
                packet_history: [0; 256],
                history_idx: 0,
            },
            tick_count: 0,
        }
    }
    
    /// Procesar paquete de red (devuelve true si debe descartarse)
    pub fn process_packet(&mut self, packet: &[u8]) -> bool {
        self.tick_count += 1;
        
        // Actualizar fase Schumann (~16ms por paquete promedio)
        self.state.schumann_phase += 16.0 / SCHUMANN_BASE_MS;
        if self.state.schumann_phase >= 1.0 {
            self.state.schumann_phase -= 1.0;
            self.cycle_winik();
        }
        
        // Registrar paquete en historia
        let packet_hash = self.hash_packet(packet);
        self.state.packet_history[self.state.history_idx] = packet_hash;
        self.state.history_idx = (self.state.history_idx + 1) % 256;
        
        // Calcular presión de desviación Pascal
        let waste_pressure = self.calculate_pascal_deviation();
        
        // Presión de tamaño (paquetes grandes = sospechosos)
        let size_pressure = (packet.len() as f32 / 1500.0).min(1.0);
        
        // Presión combinada
        let net_pressure = (waste_pressure + size_pressure * 0.3).min(1.0);
        
        // Umbral dinámico
        let dynamic_threshold = VIGESIMAL_WEIGHT * (1.0 + self.state.dopamine * 0.5);
        
        if net_pressure > dynamic_threshold {
            // CASTIGO: Descartar paquete
            self.state.threshold = (self.state.threshold * 0.7).max(0.15);
            self.state.cleaned_total += 1;
            self.state.dopamine = (self.state.dopamine + 0.10).min(1.0);
            return true; // DROP
        }
        
        // RECOMPENSA: Dejar pasar
        self.state.dopamine = (self.state.dopamine * 0.9998).clamp(0.1, 1.0);
        false // PASS
    }
    
    fn hash_packet(&self, packet: &[u8]) -> u8 {
        let mut hash: u32 = 0;
        for &byte in packet.iter().take(64) {
            hash = hash.wrapping_add(byte as u32);
        }
        (hash % 64) as u8
    }
    
    fn calculate_pascal_deviation(&self) -> f32 {
        let mut actual = [0.0_f32; 5];
        let mut counts = [0.0_f32; 5];
        
        for (i, &val) in self.state.packet_history.iter().enumerate() {
            let ring = ((i * 5) / 256).min(4);
            actual[ring] += val as f32;
            counts[ring] += 1.0;
        }
        
        for i in 0..5 {
            if counts[i] > 0.0 {
                actual[i] /= counts[i];
            }
        }
        
        let total: f32 = actual.iter().sum();
        if total < 1e-6 { return 0.0; }
        
        let mse: f32 = actual.iter().zip(PASCAL_4.iter())
            .map(|(&a, &p)| {
                let diff = (a / total) - p;
                diff * diff
            })
            .sum::<f32>() / 5.0;
        
        let level = (mse.sqrt().clamp(0.0, 1.0) * 19.0).round();
        level / 19.0
    }
    
    fn cycle_winik(&mut self) {
        let prev_winik = self.state.winik_cycle;
        self.state.winik_cycle = (self.state.winik_cycle + 1) % WINIK_CYCLE;
        
        if self.state.winik_cycle < prev_winik {
            // Homeostasis: Reset parcial dopamina cada 20 ciclos
            self.state.dopamine = self.state.dopamine * 0.8 + 0.1;
        }
    }
    
    #[allow(dead_code)]
    pub fn get_stats(&self) -> (u64, u64, f32) {
        (self.tick_count, self.state.cleaned_total, self.state.dopamine)
    }
}
