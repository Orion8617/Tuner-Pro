#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# KlonOS LagKiller Mobile — Build Script Android ARM64
# Juan José Salgado Fuentes · ClonEngine v5.0.0
# ═══════════════════════════════════════════════════════════
set -e

echo "╔══════════════════════════════════════════════╗"
echo "║  LAGKILLER MOBILE — Build ARM64              ║"
echo "╚══════════════════════════════════════════════╝"

# ── Validar herramientas ────────────────────────────────────
command -v cargo      >/dev/null 2>&1 || { echo "✗ Instala Rust: https://rustup.rs"; exit 1; }
command -v cargo-ndk  >/dev/null 2>&1 || { echo "✗ Instala: cargo install cargo-ndk"; exit 1; }

# ── Detectar NDK ────────────────────────────────────────────
if [ -z "$ANDROID_NDK_HOME" ]; then
    # Buscar NDK en ubicaciones comunes
    for d in \
        "$HOME/Android/Sdk/ndk" \
        "$HOME/Library/Android/sdk/ndk" \
        "/opt/android-sdk/ndk" \
        "$ANDROID_HOME/ndk"; do
        if [ -d "$d" ]; then
            NDK_VERSION=$(ls "$d" | sort -V | tail -1)
            export ANDROID_NDK_HOME="$d/$NDK_VERSION"
            break
        fi
    done
fi

if [ -z "$ANDROID_NDK_HOME" ]; then
    echo "✗ ANDROID_NDK_HOME no configurado."
    echo "  Instala NDK desde Android Studio → SDK Manager → NDK"
    echo "  Luego: export ANDROID_NDK_HOME=/ruta/al/ndk"
    exit 1
fi

echo "✓ NDK: $ANDROID_NDK_HOME"

# ── Añadir target ARM64 ─────────────────────────────────────
rustup target add aarch64-linux-android 2>/dev/null || true
echo "✓ Target: aarch64-linux-android"

# ── Compilar Rust Core ──────────────────────────────────────
echo ""
echo "═══ Compilando ClonEngine SWARM (Rust → ARM64) ═══"
cd rust_core

cargo ndk \
    -t arm64-v8a \
    -o ../app/src/main/jniLibs \
    build --release

cd ..
LIB_SIZE=$(du -sh app/src/main/jniLibs/arm64-v8a/libclonengine_snn.so 2>/dev/null | cut -f1)
echo "✓ libclonengine_snn.so compilado ($LIB_SIZE)"

# ── Compilar APK ────────────────────────────────────────────
echo ""
echo "═══ Compilando APK Android ═══"

if [ ! -f "gradlew" ]; then
    echo "✗ Abre este proyecto en Android Studio primero para generar gradlew"
    echo "  File → Open → $(pwd)"
    exit 1
fi

chmod +x gradlew
./gradlew assembleRelease

APK_PATH="app/build/outputs/apk/release/app-release-unsigned.apk"
APK_SIZE=$(du -sh "$APK_PATH" 2>/dev/null | cut -f1)

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ BUILD COMPLETO                            ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  APK: $APK_PATH"
echo "║  Size: $APK_SIZE"
echo "╠══════════════════════════════════════════════╣"
echo "║  Instalar en dispositivo:"
echo "║  adb install -r $APK_PATH"
echo "╚══════════════════════════════════════════════╝"
