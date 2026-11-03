# Zentrale

Persönliches Dashboard als statische Seite (GitHub Pages, Ordner `docs/`).
Alle Daten liegen verschlüsselt (AES-256-GCM, Schlüssel per PBKDF2 aus einem Passwort) in den Branches `daten-*`;
ohne Passwort sind sie nicht lesbar. `cloud/` holt Zahlen per GitHub Actions, `kern/` enthält die gemeinsame Verschlüsselung.
