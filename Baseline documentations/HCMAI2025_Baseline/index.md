# Tutorial: HCMAI2025_Baseline

This project provides a **Keyframe Search API** designed to help users efficiently find specific *video keyframes*.
By inputting natural language queries, the system leverages advanced *semantic search* techniques
to understand the intent and retrieve the most relevant keyframes from a large dataset,
offering flexible filtering options by video groups or individual videos.


**Source Repository:** [None](None)

```mermaid
flowchart TD
    A0["FastAPI Application Core
"]
    A1["Configuration & Settings
"]
    A2["Keyframe Data Model
"]
    A3["Data Access Layer (Repositories)
"]
    A4["Semantic Search Services
"]
    A5["Service Factory & Dependency Management
"]
    A6["Query Controller
"]
    A0 -- "Uses Lifespan" --> A5
    A0 -- "Registers API Routes" --> A6
    A0 -- "Accesses Configuration" --> A1
    A1 -- "Provides Settings" --> A5
    A1 -- "Informs Controller Paths" --> A6
    A1 -- "Configures Services" --> A4
    A2 -- "Defines Structure" --> A3
    A2 -- "Structures Service Output" --> A4
    A2 -- "Formats API Responses" --> A6
    A2 -- "Registered by Lifespan" --> A5
    A3 -- "Provides Data Access" --> A4
    A3 -- "Managed by Factory" --> A5
    A4 -- "Utilizes Repositories" --> A3
    A4 -- "Executes Search Logic" --> A6
    A4 -- "Instantiated by Factory" --> A5
    A5 -- "Provides Controller" --> A6
    A6 -- "Handles API Requests" --> A0
```

## Chapters

1. [Keyframe Data Model
](01_keyframe_data_model_.md)
2. [FastAPI Application Core
](02_fastapi_application_core_.md)
3. [Query Controller
](03_query_controller_.md)
4. [Configuration & Settings
](04_configuration___settings_.md)
5. [Semantic Search Services
](05_semantic_search_services_.md)
6. [Data Access Layer (Repositories)
](06_data_access_layer__repositories__.md)
7. [Service Factory & Dependency Management
](07_service_factory___dependency_management_.md)
