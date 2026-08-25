# skinbabe — Shopify Theme

Custom Online-Store-2.0-Theme. Design-DNA orientiert an gethandfee.de
(Creme-Weiß-Flächen, viel Weißraum, Pill-Buttons, Kleinschreibung,
kursive Serif-Akzente, Pfeil-CTAs), Copy-Struktur und Tonalität nach
`skinbabe — Copy & Store-Struktur`.

Keine Build-Tools, keine Abhängigkeiten. Reines Liquid, CSS und Vanilla JS.

## Struktur

```
assets/     base.css (Tokens & Grundlagen), components.css, theme.js
config/     settings_schema.json, settings_data.json
layout/     theme.liquid, password.liquid
locales/    de.default.json, en.json
sections/   globale + Content-Sections, header-group.json, footer-group.json
snippets/   wiederverwendbare Bausteine
templates/  JSON-Templates + Kundenkonto-Templates
```

## Design-Tokens

Alle Farben, Fonts, Abstände und Radien laufen über CSS-Variablen in
`snippets/css-variables.liquid`, gespeist aus den Theme-Einstellungen.
Ein Rebrand ist eine Änderung im Customizer, kein Eingriff in den Code.

| Token | Standard | Bedeutung |
|---|---|---|
| `--sb-bg` | `#FFFFFF` | Grundfläche |
| `--sb-ink` | `#16130F` | Text, Buttons, Linien |
| `--sb-cream` | `#F5EFE9` | zweite Fläche, Karten-Hintergrund |
| `--sb-accent` | `#A97E6D` | Akzent, Fortschrittsleiste, Badges |
| `--sb-gold` | `#C9A227` | Bewertungssterne |
| `--sb-sale` | `#A63D2F` | echte Streichpreise |

Fonts: Headline `Poppins` (Kleinschreibung, negative Laufweite),
Fließtext `Assistant`, Akzent `Playfair Display` kursiv. Alle drei aus der
Shopify-Font-Bibliothek, also selbst gehostet und ohne externe Requests.

## Startseite

Die Sektionsreihenfolge in `templates/index.json` folgt dem Briefing:

1. Ankündigungsleiste — Sachinfos, kein Countdown, kein Dauer-Sale
2. Hero — Zustand statt Feature, darunter Rückgabefrist, Lieferzeit, Zahlung
3. Laufband — fünf kurze Sachargumente
4. Bestseller-Zeile — maximal drei Produkte, je eine Nutzen-Zeile
5. Diagnose & Mechanismus — das Herzstück, bewusst weit oben
6. Was sich ändert — vier Alltagsveränderungen
7. Community — echte Kundinnen mit verlinkten Handles
8. Garantie — Bedingungen inklusive Begründung
9. FAQ — die Fragen vor dem Kauf, mit FAQPage-Markup
10. Newsletter

## Produktseiten

Drei fertige Vorlagen. Zuweisung im Produkt unter *Theme-Vorlage*.

| Template | Für | Besonderheit |
|---|---|---|
| `product` | Rasierer und Zubehör | Mengenstufen (1×/2×), Abo-Block, 30 Tage |
| `product.ipl` | IPL-Geräte | Eignungshinweis über dem Kaufbutton, Optionen als echte Produkte, 90 Tage |
| `product.bundle` | Set-Produkte | zusätzlich der Set-Konfigurator |

Oberhalb der Falz in dieser Reihenfolge: Titel → Preis → vier Kurz-Argumente
→ Kaufoptionen → Variante → Kaufbutton → Zahlungsarten → Vertrauensraster.

### Kaufoptionen / Bundles

Der Block **„Kaufoption / Bundle"** ist mehrfach einsetzbar (bis 4). Jede
Option arbeitet in einem von zwei Modi:

- **Anderes Produkt** — die Angebots-Leiter. Option zeigt auf ein eigenes
  Shopify-Produkt mit eigenem Preis (Rasierer-Set → Rasierer + IPL → Komplett).
- **Mengenstufe** — 1×, 2×, 3× dieses Produkts. Der Stückpreis wird
  ausgerechnet und angezeigt.

Pro Option einstellbar: Bezeichnung, Untertitel, Badge („Beliebteste Wahl"),
Zusatzhinweis, Bild, Vorauswahl. Preis und Streichpreis kommen immer aus
Shopify — es gibt kein Feld für einen frei erfundenen Referenzpreis.

Wenn du Kaufoptionen nutzt, lass den Block *Variantenauswahl* weg. Sonst
konkurrieren zwei Auswahlen um dasselbe Formular.

### Weitere Blöcke

- **Hinweis über dem Kaufbutton** — für IPL: Haut- und Haartypen, sichtbar
  über dem Button statt in der FAQ
- **Nachkauf / Abo** — zeigt die in Shopify angelegten Kaufpläne; ohne
  Kaufpläne wird der Block nicht ausgegeben
- **USP-Reihe**, **Spezifikationen**, **Zahlungsarten**, **Lagerhinweis**

### Sticky-Kaufleiste

Erscheint, sobald der Kaufbutton aus dem Bild scrollt, und übernimmt den
aktuellen Preis aus Varianten- und Bundle-Auswahl. Abschaltbar in den
Section-Einstellungen.

## Was das Theme technisch durchsetzt

- **Rabatt-Badges nur bei echtem `compare_at_price`.** Es gibt keine
  Einstellung für einen frei erfundenen Streichpreis.
- **Keine Testimonial-Blöcke ohne Quelle.** Die Community-Section verlangt
  Bild, Handle und Link; im Customizer steht der Hinweis dazu.
- **Kein Countdown, kein Dauer-Sale** in der Ankündigungsleiste.
- **Eine Kundenzahl.** Es gibt keinen zweiten Ort im Theme, an dem eine
  Kundenzahl gepflegt wird — Widersprüche entstehen also nicht durch das Theme.

Das ersetzt keine rechtliche Prüfung vor dem Launch.

## Einrichtung im Shop

**1. Theme hochladen**

```bash
shopify theme push --unpublished
# oder: als ZIP über Onlineshop → Themes → Hochladen
```

**2. Navigation anlegen** (Onlineshop → Menüs)

- `main-menu` — Hauptmenü im Header
- Ein Menü pro Footer-Spalte, plus ein Menü für die Rechtliches-Zeile

Für ein Mega-Menü im Header: Block „Mega-Menü" im Header hinzufügen und
unter *Menüpunkt* den **exakten Titel** aus dem Hauptmenü eintragen.
Ein `*` am Ende eines Menütitels hebt den Punkt farblich hervor.

**3. Seiten anlegen** und Template zuweisen

| Seite | Template | Zweck |
|---|---|---|
| Warum Haare einwachsen | `page.mechanismus` | Ad-Angle als Landingpage, stärkster SEO-Einstieg |
| Rasierer oder IPL | `page.vergleich` | Entscheidungshilfe, sonst kauft sie keins von beidem |
| Über uns | `page.ueber-uns` | echter Name, echtes Gesicht, echte Geschichte |
| Versand & Rückgabe | `page.versand` | eigene Seite, nicht nur Footer-Kleingedrucktes |
| Kontakt | `page.contact` | Formular mit Antwortzeit |

**4. Metafeld für Produkt-Untertitel** (optional, empfohlen)

Einstellungen → Benutzerdefinierte Daten → Produkte:

- Namespace/Schlüssel: `skinbabe.card_subtitle`
- Typ: Einzeiliger Text

Der Untertitel erscheint dann automatisch auf jeder Produktkarte und auf der
Produktseite. Alternativ pro Bestseller-Block im Customizer pflegen.

**5. Versandschwelle**

Theme-Einstellungen → Warenkorb → *Versandkostenfrei ab*: Wert in **Cent**
(`5000` = 50 €). Steuert die Fortschrittsleiste in Drawer und Warenkorb.
Leer lassen blendet die Leiste aus. Der Wert muss zur echten Versandregel
in den Shop-Einstellungen passen.

**6. Bewertungssterne**

Die Produktkarte liest `product.metafields.reviews.rating` und
`reviews.rating_count` — das Standard-Schema von Shopify Product Reviews,
Judge.me, Loox und Okendo. Ohne installierte App wird nichts angezeigt.

## Angebots-Leiter

Die Bestseller-Zeile ist auf drei Positionen ausgelegt:

| Position | Angebot | Rolle |
|---|---|---|
| 1 | Rasierer-Set | Einstieg, Impulskauf |
| 2 | Rasierer + IPL | Zielposition, höchster AOV |
| 3 | Komplett-Set | Anker nach oben |

Die mittlere Karte ist das Ziel. Der Untertitel jeder Karte sollte erklären,
welches Problem sie löst — sonst entscheidet sich niemand.

## Set-Konfigurator

Eigene Section (`Set-Konfigurator`), nutzbar auf Startseite, Produktseite
oder eigener Landingpage. Jeder Block ist ein Schritt, die Auswahl je Schritt
kommt aus einer **Kategorie** — neue Optionen fügst du hinzu, indem du ein
Produkt in die Kategorie legst, nicht indem du das Theme anfasst.

Pro Schritt einstellbar: Titel, Beschreibung, Kategorie, maximale Anzahl
Optionen, Menge pro Auswahl, Pflicht oder optional. Optionale Schritte
bekommen automatisch eine „Nicht dazunehmen"-Karte.

Die Summe rechts rechnet live mit, ein Klick legt alle Positionen gemeinsam
in den Warenkorb.

## Section-Übersicht

| Section | Zweck |
|---|---|
| Hero | Zustand statt Feature, mit Kennzahlen-Leiste |
| Laufband | kurze Sachargumente im Endlosband |
| Presse / Logos | „gesehen bei", nur mit Link zum Beitrag |
| Bestseller-Zeile | max. 3 Produkte mit Nutzen-Untertitel |
| Diagnose & Mechanismus | Selbstdiagnosen, dann Auflösung |
| So funktioniert es | 3–4 Schritte mit Bild |
| Was sich ändert | vier Alltagsveränderungen |
| Vorher / Nachher | Vergleichsslider, ziehbar |
| Set-Konfigurator | mehrstufige Zusammenstellung |
| Community | echte Handles, verlinkt |
| Bewertungen | echte Bewertungen mit Quelle |
| Feature-Reihen | alternierende Bild-Text-Blöcke |
| Vergleichstabelle | gegen Waxing und Salon |
| Kennzahlen | Zahlenband, optional hochzählend |
| Video | Shopify-Video oder Einbettung |
| Garantie | Bedingungen mit Begründung |
| FAQ | mit optionalem FAQPage-Markup |
| Newsletter | mit rechtlichem Hinweis |

## Eigene Display-Schrift

Theme-Einstellungen → Typografie → *Eigene Schrift*. Eine lizenzierte
`.woff2` unter Inhalte → Dateien hochladen, URL eintragen, Schriftname
vergeben, Rolle wählen (Überschriften / Fließtext / beide). Überschreibt
die Wahl aus der Shopify-Bibliothek.

Ohne eigene Schrift greifen die font_picker-Einstellungen; ist dort nichts
gesetzt, greift ein definierter Fallback-Stack. Die Typografie fällt in
keinem Fall auf die Browser-Standardschrift zurück.

## Entwicklung

```bash
shopify theme dev        # lokale Vorschau mit Hot Reload
shopify theme check      # Linter (aktuell 0 Befunde)
```
