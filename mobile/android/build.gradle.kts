allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    // Force all Android plugin subprojects (e.g. file_picker) to compile against
    // SDK 36, which is required by flutter_plugin_android_lifecycle. Flutter's
    // default compileSdkVersion (34) is too low for some plugins. Uses the modern
    // AGP DSL (CommonExtension) since BaseExtension was removed in AGP 9.
    //
    // This afterEvaluate must be registered BEFORE evaluationDependsOn(":app")
    // below, otherwise the subproject may already be evaluated and Gradle throws
    // "Cannot run Project.afterEvaluate when the project is already evaluated".
    afterEvaluate {
        extensions.findByType(com.android.build.api.dsl.CommonExtension::class.java)?.let { ext ->
            if ((ext.compileSdk ?: 0) < 36) {
                ext.compileSdk = 36
            }
        }
    }
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
