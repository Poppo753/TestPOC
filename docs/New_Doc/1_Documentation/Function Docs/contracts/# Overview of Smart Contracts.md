# Overview of Smart Contracts

This document provides an overview of the smart contracts in this project, including their purpose, relationships, and key components.

## Contract Hierarchy

The system is built around a core architecture that includes:

- **Core Contracts**: These are the main contracts that manage the system's logic and state.
- **Plugin Contracts**: These contracts implement specific integrations with external protocols (e.g., Aave, Morpho).
- **Registry Contracts**: These maintain mappings of supported protocols and their configurations.
- **Adapter Contracts**: These provide interfaces for querying external data or interacting with protocols.
- **Service Contracts**: These handle specialized functions like flash loans or governance actions.

## Entry Points

The main entry point for interacting with the system is `ProtocolManager.sol`, which orchestrates operations across various plugins and registries.

## Key Features

- Modular architecture for easy integration with new protocols.
- Support for multiple external protocols through plugins.
- Secure and audited interactions with external systems.
- Gas-efficient operations where possible.