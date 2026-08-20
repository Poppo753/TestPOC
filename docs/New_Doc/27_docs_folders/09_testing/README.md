# 9. Testing

Documentazione completa della suite di test del sistema DeFi.

## Contenuti

- **[9.1 Struttura e Organizzazione](01_struttura_organizzazione.md)** — Struttura delle directory, naming conventions, tipologie di test
- **[9.2 Setup e Configurazione](02_setup_configurazione.md)** — Come eseguire i test, prerequisiti, configurazione fork
- **[9.3 Pattern e Fixtures](03_pattern_fixtures.md)** — Pattern di test, fixture system, mock contracts, base asset abstraction
- **[9.4 Risultati Completi](04_risultati_completi.md)** — Stato di tutti i test con risultati dettagliati
- **[9.5 Known Issues](05_known_issues.md)** — Failure pre-esistenti, test pending, e troubleshooting

## Quick Reference

| Categoria | File | Passing | Failing | Pending |
|-----------|------|---------|---------|---------|
| Unit Tests | 20 file | 685+ | 2 (pre-existing) | 1 |
| Integration (non-fork) | 23 file | 163 | 0 | 17 |
| Fork / E2E | 16 file | 404+ | ~24 (pre-existing) | ~25 |
| **Totale** | **59+ file** | **1250+** | **~26 pre-existing** | **~43** |

> Tutti i failing sono **pre-esistenti** e non correlati al refactoring Phase 0 (Base Asset Abstraction).
