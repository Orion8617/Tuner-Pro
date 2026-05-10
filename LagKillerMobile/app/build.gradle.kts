plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace   = "com.klonos.lagkiller"
    compileSdk  = 34
    
    defaultConfig {
        applicationId = "com.klonos.lagkiller"
        minSdk = 26
        targetSdk = 34
        versionCode = 5
        versionName = "5.0.0"
        ndk { abiFilters += listOf("arm64-v8a") }
    }
    
    sourceSets {
        getByName("main") {
            jniLibs.srcDir("src/main/jniLibs")
        }
    }
    
    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
    }
    
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    
    kotlinOptions {
        jvmTarget = "17"
    }
}

// Incremental Rust Build: Solo recompila si cambió
tasks.register<Exec>("buildRustCore") {
    workingDir = file("../rust_core")
    commandLine("cargo", "ndk", "-t", "arm64-v8a", 
                "-o", "../app/src/main/jniLibs", "build", "--release")
    
    // HPC: Cache control
    inputs.dir("../rust_core/src")
    outputs.dir("src/main/jniLibs/arm64-v8a")
}

tasks.whenTaskAdded {
    if (name in listOf("assembleDebug", "assembleRelease")) {
        dependsOn("buildRustCore")
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
}
