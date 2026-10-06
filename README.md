# Lillatorpsgatan 1B

Sidor om lägenheten på Lillatorpsgatan 1B i Örgryte, publicerade med GitHub Pages:
<https://filipgsonwfh.github.io/lillatorpsgatan-1b/>

| Sida | Vad |
| --- | --- |
| [`/`](https://filipgsonwfh.github.io/lillatorpsgatan-1b/) | Sparad kopia av bostadsannonsen med bilder, planritning och karta. |
| [`/planera/`](https://filipgsonwfh.github.io/lillatorpsgatan-1b/planera/) | Lägenhetsplaneraren: möblera lägenheten i olika versioner. |

## Lägenhetsplaneraren

En ritning av lägenheten i skala, byggd efter mäklarens planritning. Du drar in möbler från en katalog (eller egna mått), flyttar, roterar, mäter och kan justera väggar, dörrar och fönster när du mätt på plats.

**Versioner.** Varje version är en egen möblering av samma lägenhet. Skapa nya från ritningen, kopiera en befintlig, byt namn och ta bort. Allt sparas automatiskt i webbläsaren (localStorage), så sidan fungerar helt utan server.

**Dela och flytta mellan enheter.** En version kan delas som länk (hela ritningen packas in i länkens `#v=`-del) eller laddas ner som JSON-fil. Den som öppnar länken eller filen får versionen som en egen kopia i sin webbläsare.

### Filer

```
planera/
  index.html   sidans uppbyggnad
  styles.css   utseende, ljust och mörkt läge
  plan.js      ritningen: rum, väggar, öppningar, fast inredning, katalog
  versions.js  lagring, delningslänkar, fil-import/export
  app.js       editorn
```

### Rätta ritningen

Måtten ligger i `planera/plan.js` (innermått i cm, origo i vardagsrummets övre vänstra hörn). Ändra där när du mätt, och höj `version` i samma fil. Sparade versioner får då frågan om de vill hämta den nya ritningen; egna möbler behålls.

### Publicering

GitHub Pages serverar grenen `main` direkt. Allt som pushas till `main` ligger ute inom någon minut.
