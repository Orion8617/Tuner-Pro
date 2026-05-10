mod snn;

use jni::JNIEnv;
use jni::objects::{JClass, JByteArray};
use jni::sys::{jboolean, jlong, jint};
use snn::SwarmEngine;

/// JNI: Inicializar motor SWARM — devuelve puntero al heap como jlong
#[no_mangle]
pub extern "C" fn Java_com_klonos_lagkiller_LagKillerVpnService_swarmEngineInit(
    _env: JNIEnv,
    _class: JClass,
) -> jlong {
    let engine = Box::new(SwarmEngine::new());
    Box::into_raw(engine) as jlong
}

/// JNI: Procesar paquete de red — retorna true si debe descartarse (DROP)
#[no_mangle]
pub extern "C" fn Java_com_klonos_lagkiller_LagKillerVpnService_swarmEngineProcess(
    env: JNIEnv,
    _class: JClass,
    engine_ptr: jlong,
    packet_data: JByteArray,
    length: jint,
) -> jboolean {
    if engine_ptr == 0 { return false as jboolean; }
    let engine = unsafe { &mut *(engine_ptr as *mut SwarmEngine) };

    let packet_bytes = match env.convert_byte_array(packet_data) {
        Ok(bytes) => bytes,
        Err(_) => return false as jboolean,
    };

    let len = (length as usize).min(packet_bytes.len());
    engine.process_packet(&packet_bytes[..len]) as jboolean
}

/// JNI: Destruir motor y liberar memoria
#[no_mangle]
pub extern "C" fn Java_com_klonos_lagkiller_LagKillerVpnService_swarmEngineDestroy(
    _env: JNIEnv,
    _class: JClass,
    engine_ptr: jlong,
) {
    if engine_ptr != 0 {
        unsafe { drop(Box::from_raw(engine_ptr as *mut SwarmEngine)) };
    }
}
