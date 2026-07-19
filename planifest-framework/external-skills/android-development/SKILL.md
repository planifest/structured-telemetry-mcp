---
name: android-development
description: Create production-quality Android applications following Google's official architecture guidance and NowInAndroid best practices. Use when building Android apps with Kotlin, Jetpack Compose, MVVM architecture, Hilt dependency injection, Room database, or multi-module projects. Triggers on requests to create Android projects, screens, ViewModels, repositories, feature modules, or when asked about Android architecture patterns.
---

# Android Development Skill

This skill configures Claude Code to generate production-quality Android applications following Google's official architecture guidance and the NowInAndroid reference implementation.

## Technology Stack

- **Language**: Kotlin
- **UI**: Jetpack Compose
- **Architecture**: MVVM with Unidirectional Data Flow (UDF)
- **DI**: Hilt
- **Database**: Room
- **Network**: Retrofit + Kotlinx Serialization
- **Async**: Kotlin Coroutines + Flow
- **Testing**: JUnit, Turbine, Compose Testing
- **Build**: Gradle with Convention Plugins

## Architecture Principles

### Layer Structure
```
feature/
├── ui/           ← Composables, ViewModels
├── domain/       ← Use cases, domain models
└── data/         ← Repositories, data sources, Room entities
```

### ViewModel Pattern (UDF)

```kotlin
@HiltViewModel
class MyFeatureViewModel @Inject constructor(
    private val myRepository: MyRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(MyFeatureUiState())
    val uiState: StateFlow<MyFeatureUiState> = _uiState.asStateFlow()

    fun onAction(action: MyFeatureAction) {
        when (action) {
            is MyFeatureAction.UpdateItem -> updateItem(action.id)
        }
    }

    private fun updateItem(id: String) {
        viewModelScope.launch {
            myRepository.getItem(id)
                .catch { _uiState.update { it.copy(error = "Failed") } }
                .collect { item -> _uiState.update { it.copy(item = item) } }
        }
    }
}
```

### Composable Pattern

```kotlin
@Composable
fun MyFeatureScreen(
    onNavigateToDetail: (String) -> Unit,
    viewModel: MyFeatureViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    MyFeatureContent(uiState = uiState, onAction = viewModel::onAction)
}
```

## Dependency Versions (version catalog)

```toml
[libraries]
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "compose-bom" }
hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
```

## Modularization

Follow NowInAndroid modularization: `feature:`, `core:data`, `core:domain`, `core:ui`, `core:network`. Each feature module is a self-contained vertical slice.

## Testing

- **Unit tests**: JUnit + Turbine for Flow testing
- **UI tests**: Compose Testing
- **Fakes over mocks**: Prefer fake implementations for repositories in tests

## References

- [Android Developer Documentation](https://developer.android.com)
- [NowInAndroid Repository](https://github.com/android/nowinandroid)
- [Kotlin Documentation](https://kotlinlang.org/docs/home.html)
- [Jetpack Compose Pathway](https://developer.android.com/courses/pathways/compose)
