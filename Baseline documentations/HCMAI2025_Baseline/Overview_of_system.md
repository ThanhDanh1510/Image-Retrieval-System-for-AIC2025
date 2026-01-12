# Tutorial: Image-Retrieval-System-for-AIC2025

This project is an **Image Retrieval System** designed for AIC2025, enabling *intelligent search* for keyframes (important images) extracted from videos. It processes natural language queries or uploaded images to find relevant video moments by understanding their *meaning*, not just keywords. The system efficiently stores, searches, and presents these keyframes, including generating direct image URLs, making complex video content discoverable.


## Visual Overview

```mermaid
flowchart TD
    A0["Keyframe Data Model
"]
    A1["FastAPI Application Core
"]
    A2["Configuration & Settings
"]
    A3["Service Factory & Dependency Management
"]
    A4["Query Controller
"]
    A5["Semantic Search Services
"]
    A6["Data Access Layer (Repositories)
"]
    A1 -- "Initializes" --> A3
    A1 -- "Routes to" --> A4
    A2 -- "Configures" --> A3
    A2 -- "Provides URLs to" --> A4
    A3 -- "Creates" --> A5
    A3 -- "Creates" --> A6
    A3 -- "Provides instance to" --> A4
    A4 -- "Orchestrates" --> A5
    A4 -- "Formats for display" --> A0
    A5 -- "Accesses data via" --> A6
    A5 -- "Returns as response" --> A0
    A6 -- "Stores/Retrieves" --> A0
```

## Chapters

1. [Keyframe Data Model
](01_keyframe_data_model_.md)
2. [Configuration & Settings
](02_configuration___settings_.md)
3. [Data Access Layer (Repositories)
](03_data_access_layer__repositories__.md)
4. [Semantic Search Services
](04_semantic_search_services_.md)
5. [Service Factory & Dependency Management
](05_service_factory___dependency_management_.md)
6. [Query Controller
](06_query_controller_.md)
7. [FastAPI Application Core
](07_fastapi_application_core_.md)

---
