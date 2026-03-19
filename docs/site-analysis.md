# RS Municipalities Site Analysis

## Overview

- **Total municipalities**: 497
- **Source**: GUIA_RS__SITE_FAMURS.xlsx (FAMURS directory)
- **Analysis date**: 2026-03-15

## Site Categorization

| Category | Count | Percentage |
|----------|-------|------------|
| *.rs.gov.br | 442 | 88.9% |
| *.atende.net | 30 | 6.0% |
| *.com.br | 21 | 4.2% |
| Other | 4 | 0.8% |

---

## Category 1: *.rs.gov.br Sites (442 municipalities)

### CMS Platforms Identified

The rs.gov.br sites use at least 3 different CMS platforms:

1. **Cidade360** (e.g., agudo.rs.gov.br)
   - News listing: `/noticias`
   - Article URL: `/noticias/{slug}`
   - Pagination: `?per_page=12` with numbered pages
   - Date format: DD/MM/YYYY (e.g., "13/03/2026")

2. **Abase Sistemas** (e.g., alecrim.rs.gov.br, pmalegria.rs.gov.br)
   - News listing: `/site/noticias` or `/site/noticias/{category}`
   - Article URL: `/site/conteudos/{id}-{slug}` or `/site/noticias/{category}/{id}-{slug}`
   - Pagination: Numbered pages 1-N
   - Date format: DD/MM/YYYY

3. **Kingpage** (e.g., ajuricaba.rs.gov.br)
   - News listing: `/noticia/categoria/`
   - Article URL: `/noticia/{id}/{slug}/`
   - Date format: DD/MM/YYYY

4. **Custom/Proprietary** (e.g., alegrete.rs.gov.br)
   - News listing: `/noticias` (shows "Lista de noticias")
   - Article URL: `/artigo/{id}/{slug}`
   - Date format: Relative ("ha 3 dias") on listing, DD/MM/YYYY on article
   - Pagination: Numbered pages with per-page selector

5. **Drupal** (Porto Alegre - prefeitura.poa.br)
   - News listing: `/noticias`
   - Article URL: `/{department}/noticias/{slug}`
   - Uses Drupal Views, Search API, Matomo analytics

### Scraping Strategy for rs.gov.br

Try news URL paths in order:
1. `/noticias` (most common)
2. `/site/noticias` (Abase sites)
3. `/noticia/categoria/` (Kingpage sites)

### Sample URLs

| Municipality | Site | Likely News URL |
|-------------|------|-----------------|
| AGUDO | www.agudo.rs.gov.br | /noticias |
| ALEGRETE | www.alegrete.rs.gov.br | /noticias |
| ALECRIM | www.alecrim.rs.gov.br | /site/noticias |
| AJURICABA | www.ajuricaba.rs.gov.br | /noticia/categoria/ |
| PMALEGRIA | www.pmalegria.rs.gov.br | /site/noticias |

---

## Category 2: *.atende.net Sites (30 municipalities)

### Known Issues

- **SSL Certificate Error**: All atende.net sites fail with `ERR_TLS_CERT_ALTNAME_INVALID`
- HTTPS requests are rejected; HTTP requests also fail or redirect to HTTPS
- These sites may require `rejectUnauthorized: false` in Node.js or `--insecure` in curl
- Some may be completely offline (`ECONNREFUSED`)

### Scraping Strategy for atende.net

1. Use HTTP with SSL verification disabled: `NODE_TLS_REJECT_UNAUTHORIZED=0`
2. Or use a custom HTTPS agent with `rejectUnauthorized: false`
3. Try news paths: `/noticias`, `/portal/noticias`
4. These sites may need to be handled as a separate batch with error tolerance

### All atende.net Municipalities

| Municipality | Site |
|-------------|------|
| ACEGUÁ | www.acegua.atende.net |
| BARRA DO GUARITA | www.barradoguarita.atende.net |
| BOM PROGRESSO | www.bomprogresso.atende.net |
| CAIÇARA | www.caicara.atende.net |
| CANDELÁRIA | www.candelaria.atende.net |
| CORONEL BICACO | www.coronelbicaco.atende.net |
| CRISTAL DO SUL | www.cristaldosul.atende.net |
| CRUZ ALTA | www.cruzalta.atende.net |
| GRAMADO | www.gramado.atende.net |
| GRAMADO XAVIER | gramadoxavier.atende.net |
| GRAVATAÍ | www.gravatai.atende.net |
| GUAÍBA | www.guaiba.atende.net |
| HORIZONTINA | www.horizontina.atende.net |
| INHACORÁ | www.inhacora.atende.net |
| JABOTICABA | www.jaboticaba.atende.net |
| LAGOA BONITA DO SUL | www.lagoabonitadosul.atende.net |
| LAGOA VERMELHA | www.lagoavermelha.atende.net |
| MAÇAMBARÁ | www.macambara.atende.net |
| NOVA SANTA RITA | www.novasantarita.atende.net |
| PALMEIRA DAS MISSÕES | www.palmeiradasmissoes.atende.net |
| PALMITINHO | www.palmitinho.atende.net |
| PANAMBI | www.panambi.atende.net |
| PAROBÉ | www.parobe.atende.net |
| PINHAL | www.pinhal.atende.net |
| ROLANTE | www.rolante.atende.net |
| SÃO SEPÉ | www.saosepe.atende.net |
| SAPIRANGA | www.sapiranga.atende.net |
| SEBERI | www.seberi.atende.net |
| SEDE NOVA | www.sedenova.atende.net |
| SENADOR SALGADO FILHO | senadorsalgadofilho.atende.net |

---

## Category 3: *.com.br Sites (21 municipalities)

### Known Issues

- Many .com.br sites redirect to .rs.gov.br domains (e.g., crissiumal-rs.com.br -> crissiumal.rs.gov.br)
- Some have SSL issues similar to atende.net
- Some may be completely offline (`ECONNREFUSED`)
- Need to follow redirects and re-categorize

### All com.br Municipalities

| Municipality | Site |
|-------------|------|
| ÁGUA SANTA | www.aguasantars.com.br |
| ARATIBA | www.pmaratiba.com.br |
| CHUVISCA | www.chuvisca.rs.gov.com.br |
| COLINAS | www.colinasrs.com.br |
| CRISSIUMAL | www.crissiumal-rs.com.br |
| DERRUBADAS | www.derrubadas-rs.com.br |
| DOUTOR MAURÍCIO CARDOSO | www.pdrmcard.com.br |
| GENTIL | www.pmgentil.com.br |
| IMIGRANTE | www.imigrante-rs.com.br |
| MARAU | www.pmmarau.com.br |
| MATO QUEIMADO | www.matoqueimado-rs.com.br |
| NOVO TIRADENTES | www.novotiradentesrs.com.br |
| PELOTAS | www.pelotas.com.br |
| ROCA SALES | www.rocasales-rs.com.br |
| SANANDUVA | www.sananduva.rs.com.br |
| SANTANA DO LIVRAMENTO | www.sdolivramento.com.br |
| SANTO ANTÔNIO DO PALMA | www.pmpalma.com.br |
| VANINI | www.prefeituradevanini.com.br |
| VESPASIANO CORRÊA | www.vespasianocorrears.com.br |
| VISTA ALEGRE | www.pmvistaalegre.com.br |
| VISTA GAÚCHA | www.vistagaucha-rs.com.br |

---

## Category 4: Other Sites (4 municipalities)

| Municipality | Site | Notes |
|-------------|------|-------|
| BOQUEIRÃO DO LEÃO | www.boqueirãodoleão.gov.br | Non-standard domain |
| BOZANO | www.bozano.gov.br | Non-standard domain |
| CACHOEIRA DO SUL | www.cachoeiradosul.gov.rs.br | Non-standard domain |
| PORTO ALEGRE | www.prefeitura.poa.br | Non-standard domain |

---

## Scraping Patterns Summary

### Pattern A: Cidade360 CMS (`/noticias`)
```
Listing: https://{domain}/noticias?per_page=12&page=1
Article: https://{domain}/noticias/{slug}
Selector: Look for article cards with title, date, excerpt
Date: DD/MM/YYYY
```

### Pattern B: Abase CMS (`/site/noticias`)
```
Listing: https://{domain}/site/noticias
Article: https://{domain}/site/conteudos/{id}-{slug}
  or:    https://{domain}/site/noticias/{category}/{id}-{slug}
Date: DD/MM/YYYY
```

### Pattern C: Kingpage CMS (`/noticia/categoria/`)
```
Listing: https://{domain}/noticia/categoria/
Article: https://{domain}/noticia/{id}/{slug}/
Date: DD/MM/YYYY
```

### Pattern D: Custom/Artigo-based (`/noticias` with `/artigo` articles)
```
Listing: https://{domain}/noticias
Article: https://{domain}/artigo/{id}/{slug}
Date: Relative on listing, DD/MM/YYYY on article page
```

### Pattern E: Drupal (Porto Alegre only)
```
Listing: https://prefeitura.poa.br/noticias
Article: https://prefeitura.poa.br/{dept}/noticias/{slug}
```

---

## Recommended Scraping Approach

1. **Auto-detect CMS**: For each site, try `/noticias` first, then `/site/noticias`, then `/noticia/categoria/`
2. **Follow redirects**: Many .com.br domains redirect to .rs.gov.br
3. **Handle SSL**: For atende.net, disable SSL verification
4. **Rate limiting**: Add delays between requests (1-2 seconds)
5. **Error tolerance**: Log failures and continue; some sites may be temporarily offline
6. **Date parsing**: Always expect DD/MM/YYYY format (Brazilian standard)

---

## Full Municipality List

| # | Municipality | Association | Site | Category |
|---|-------------|------------|------|----------|
| 1 | ACEGUÁ | AZONASUL | www.acegua.atende.net | atende.net |
| 2 | ÁGUA SANTA | AMUNOR | www.aguasantars.com.br | com.br |
| 3 | AGUDO | AMCENTRO | www.agudo.rs.gov.br | gov.br |
| 4 | AJURICABA | AMUPLAM | www.ajuricaba.rs.gov.br | gov.br |
| 5 | ALECRIM | AMUFRON | www.alecrim.rs.gov.br | gov.br |
| 6 | ALEGRETE | AMFRO | www.alegrete.rs.gov.br | gov.br |
| 7 | ALEGRIA | AMUFRON | www.pmalegria.rs.gov.br | gov.br |
| 8 | ALMIRANTE TAMANDARÉ DO SUL | AMAJA | www.almirantetamandaredosul.rs.gov.br | gov.br |
| 9 | ALPESTRE | AMZOP | www.alpestre.rs.gov.br | gov.br |
| 10 | ALTO ALEGRE | AMASBI | www.altoalegre.rs.gov.br | gov.br |
| 11 | ALTO FELIZ | AMVARC | www.altofeliz.rs.gov.br | gov.br |
| 12 | ALVORADA | GRANPAL | www.alvorada.rs.gov.br | gov.br |
| 13 | AMARAL FERRADOR | AZONASUL | www.amaralferrador.rs.gov.br | gov.br |
| 14 | AMETISTA DO SUL | AMNG | www.ametistadosul.rs.gov.br | gov.br |
| 15 | ANDRÉ DA ROCHA | AMESNE | www.andredarocha.rs.gov.br | gov.br |
| 16 | ANTA GORDA | AMAT | www.antagorda.rs.gov.br | gov.br |
| 17 | ANTÔNIO PRADO | AMESNE | www.antonioprado.rs.gov.br | gov.br |
| 18 | ARAMBARÉ | ACOSTADOCE | www.arambare.rs.gov.br | gov.br |
| 19 | ARARICÁ | AMVAG | www.ararica.rs.gov.br | gov.br |
| 20 | ARATIBA | AMAU | www.pmaratiba.com.br | com.br |
| 21 | ARROIO DO MEIO | AMVAT | www.arroiodomeio.rs.gov.br | gov.br |
| 22 | ARROIO DO PADRE | AZONASUL | www.arroiodopadre.rs.gov.br | gov.br |
| 23 | ARROIO DO SAL | AMLINORTE | www.arroiodosal.rs.gov.br | gov.br |
| 24 | ARROIO DO TIGRE | AMCSERRA | www.arroiodotigre.rs.gov.br | gov.br |
| 25 | ARROIO DOS RATOS | ASMURC | www.arroiodosratos.rs.gov.br | gov.br |
| 26 | ARROIO GRANDE | AZONASUL | www.arroiogrande.rs.gov.br | gov.br |
| 27 | ARVOREZINHA | AMAT | www.arvorezinha.rs.gov.br | gov.br |
| 28 | AUGUSTO PESTANA | AMUPLAM | www.augustopestana.rs.gov.br | gov.br |
| 29 | ÁUREA | AMAU | www.aurea.rs.gov.br | gov.br |
| 30 | BAGÉ | ASSUDOESTE | www.bage.rs.gov.br | gov.br |
| 31 | BALNEÁRIO PINHAL | AMLINORTE | www.balneariopinhal.rs.gov.br | gov.br |
| 32 | BARÃO | AMVARC | www.barao.rs.gov.br | gov.br |
| 33 | BARÃO DE COTEGIPE | AMAU | www.baraodecotegipe.rs.gov.br | gov.br |
| 34 | BARÃO DO TRIUNFO | ASMURC | www.baraodotriunfo.rs.gov.br | gov.br |
| 35 | BARRA DO GUARITA | AMUCELEIRO | www.barradoguarita.atende.net | atende.net |
| 36 | BARRA DO QUARAÍ | AMFRO | www.barradoquarai.rs.gov.br | gov.br |
| 37 | BARRA DO RIBEIRO | ACOSTADOCE | www.barradoribeiro.rs.gov.br | gov.br |
| 38 | BARRA DO RIO AZUL | AMAU | www.barradorioazul.rs.gov.br | gov.br |
| 39 | BARRA FUNDA | AMNG | www.barrafunda.rs.gov.br | gov.br |
| 40 | BARRACÃO | AMUNOR | www.barracao.rs.gov.br | gov.br |
| 41 | BARROS CASSAL | AMASBI | www.barroscassal.rs.gov.br | gov.br |
| 42 | BENJAMIN CONSTANT DO SUL | AMAU | www.benjaminconstantdosul.rs.gov.br | gov.br |
| 43 | BENTO GONÇALVES | AMESNE | www.bentogoncalves.rs.gov.br | gov.br |
| 44 | BOA VISTA DAS MISSÕES | AMZOP | www.boavistadasmissoes.rs.gov.br | gov.br |
| 45 | BOA VISTA DO BURICÁ | AMUFRON | www.boavistadoburica.rs.gov.br | gov.br |
| 46 | BOA VISTA DO CADEADO | AMAJA | www.boavistadocadeado.rs.gov.br | gov.br |
| 47 | BOA VISTA DO INCRA | AMAJA | www.boavistadoincra.rs.gov.br | gov.br |
| 48 | BOA VISTA DO SUL | AMESNE | www.boavistadosul.rs.gov.br | gov.br |
| 49 | BOM JESUS | AMUCSER | www.bomjesus.rs.gov.br | gov.br |
| 50 | BOM PRINCÍPIO | AMVARC | www.bomprincipio.rs.gov.br | gov.br |
| 51 | BOM PROGRESSO | AMUCELEIRO | www.bomprogresso.atende.net | atende.net |
| 52 | BOM RETIRO DO SUL | AMVAT | www.bomretirodosul.rs.gov.br | gov.br |
| 53 | BOQUEIRÃO DO LEÃO | AMVARP | www.boqueirãodoleão.gov.br | other |
| 54 | BOSSOROCA | AMM | www.bossoroca.rs.gov.br | gov.br |
| 55 | BOZANO | AMUPLAM | www.bozano.gov.br | other |
| 56 | BRAGA | AMUCELEIRO | www.braga.rs.gov.br | gov.br |
| 57 | BROCHIER | AMVARC | www.brochier.rs.gov.br | gov.br |
| 58 | BUTIÁ | ASMURC | www.butia.rs.gov.br | gov.br |
| 59 | CAÇAPAVA DO SUL | ASSUDOESTE | www.cacapavadosul.rs.gov.br | gov.br |
| 60 | CACEQUI | AMCENTRO | www.cacequi.rs.gov.br | gov.br |
| 61 | CACHOEIRA DO SUL | AMCENTRO | www.cachoeiradosul.gov.rs.br | other |
| 62 | CACHOEIRINHA | GRANPAL | www.cachoeirinha.rs.gov.br | gov.br |
| 63 | CACIQUE DOBLE | AMUNOR | www.caciquedoble.rs.gov.br | gov.br |
| 64 | CAIBATÉ | AMM | www.caibate.rs.gov.br | gov.br |
| 65 | CAIÇARA | AMZOP | www.caicara.atende.net | atende.net |
| 66 | CAMAQUÃ | ACOSTADOCE | www.camaqua.rs.gov.br | gov.br |
| 67 | CAMARGO | AMPLA | www.pmcamargo.rs.gov.br | gov.br |
| 68 | CAMBARÁ DO SUL | AMSERRA | www.cambaradosul.rs.gov.br | gov.br |
| 69 | CAMPESTRE DA SERRA | AMUCSER | www.campestredaserra.rs.gov.br | gov.br |
| 70 | CAMPINA DAS MISSÕES | AMUFRON | www.campinadasmissoes.rs.gov.br | gov.br |
| 71 | CAMPINAS DO SUL | AMAU | www.campinasdosul.rs.gov.br | gov.br |
| 72 | CAMPO BOM | AMVAG | www.campobom.rs.gov.br | gov.br |
| 73 | CAMPO NOVO | AMUCELEIRO | www.camponovo.rs.gov.br | gov.br |
| 74 | CAMPOS BORGES | AMASBI | www.camposborges.rs.gov.br | gov.br |
| 75 | CANDELÁRIA | AMVARP | www.candelaria.atende.net | atende.net |
| 76 | CÂNDIDO GODÓI | AMUFRON | www.candidogodoi.rs.gov.br | gov.br |
| 77 | CANDIOTA | AZONASUL | www.candiota.rs.gov.br | gov.br |
| 78 | CANELA | AMSERRA | www.canela.rs.gov.br | gov.br |
| 79 | CANGUÇU | AZONASUL | www.cangucu.rs.gov.br | gov.br |
| 80 | CANOAS | GRANPAL | www.canoas.rs.gov.br | gov.br |
| 81 | CANUDOS DO VALE | AMVAT | www.canudosdovale.rs.gov.br | gov.br |
| 82 | CAPÃO BONITO DO SUL | AMUNOR | www.capaobonitodosul.rs.gov.br | gov.br |
| 83 | CAPÃO DA CANOA | AMLINORTE | www.capaodacanoa.rs.gov.br | gov.br |
| 84 | CAPÃO DO CIPÓ | AMCENTRO | www.capaodocipo.rs.gov.br | gov.br |
| 85 | CAPÃO DO LEÃO | AZONASUL | www.capaodoleao.rs.gov.br | gov.br |
| 86 | CAPELA DE SANTANA | AMVARC | www.capeladesantana.rs.gov.br | gov.br |
| 87 | CAPITÃO | AMVAT | www.capitao.rs.gov.br | gov.br |
| 88 | CAPIVARI DO SUL | AMLINORTE | www.capivaridosul.rs.gov.br | gov.br |
| 89 | CARAÁ | AMLINORTE | www.caraa.rs.gov.br | gov.br |
| 90 | CARAZINHO | AMAJA | www.carazinho.rs.gov.br | gov.br |
| 91 | CARLOS BARBOSA | AMESNE | www.carlosbarbosa.rs.gov.br | gov.br |
| 92 | CARLOS GOMES | AMAU | www.carlosgomes.rs.gov.br | gov.br |
| 93 | CASCA | AMPLA | www.casca.rs.gov.br | gov.br |
| 94 | CASEIROS | AMUNOR | www.caseiros.rs.gov.br | gov.br |
| 95 | CATUÍPE | AMUPLAM | www.catuipe.rs.gov.br | gov.br |
| 96 | CAXIAS DO SUL | AMESNE | www.caxias.rs.gov.br | gov.br |
| 97 | CENTENÁRIO | AMAU | www.centenario.rs.gov.br | gov.br |
| 98 | CERRITO | AZONASUL | www.cerrito.rs.gov.br | gov.br |
| 99 | CERRO BRANCO | AMCSERRA | www.pmcerrobranco.rs.gov.br | gov.br |
| 100 | CERRO GRANDE | AMZOP | www.cerrogrande.rs.gov.br | gov.br |
| 101 | CERRO GRANDE DO SUL | ACOSTADOCE | www.cerrograndedosul.rs.gov.br | gov.br |
| 102 | CERRO LARGO | AMM | www.cerrolargo.rs.gov.br | gov.br |
| 103 | CHAPADA | AMZOP | www.chapada.rs.gov.br | gov.br |
| 104 | CHARQUEADAS | ASMURC | www.charqueadas.rs.gov.br | gov.br |
| 105 | CHARRUA | AMAU | www.charrua.rs.gov.br | gov.br |
| 106 | CHIAPETTA | AMUCELEIRO | www.chiapetta.rs.gov.br | gov.br |
| 107 | CHUÍ | AZONASUL | www.chui.rs.gov.br | gov.br |
| 108 | CHUVISCA | ACOSTADOCE | www.chuvisca.rs.gov.com.br | com.br |
| 109 | CIDREIRA | AMLINORTE | www.cidreira.rs.gov.br | gov.br |
| 110 | CIRÍACO | AMPLA | www.ciriaco.rs.gov.br | gov.br |
| 111 | COLINAS | AMVAT | www.colinasrs.com.br | com.br |
| 112 | COLORADO | AMAJA | www.colorado.rs.gov.br | gov.br |
| 113 | CONDOR | AMUPLAM | www.condor.rs.gov.br | gov.br |
| 114 | CONSTANTINA | AMNG | www.constantina.rs.gov.br | gov.br |
| 115 | COQUEIRO BAIXO | AMAT | www.coqueirobaixo.rs.gov.br | gov.br |
| 116 | COQUEIROS DO SUL | AMAJA | www.coqueirosdosul.rs.gov.br | gov.br |
| 117 | CORONEL BARROS | AMUPLAM | www.coronelbarros.rs.gov.br | gov.br |
| 118 | CORONEL BICACO | AMUCELEIRO | www.coronelbicaco.atende.net | atende.net |
| 119 | CORONEL PILAR | AMESNE | www.coronelpilar.rs.gov.br | gov.br |
| 120 | COTIPORÃ | AMESNE | www.cotipora.rs.gov.br | gov.br |
| 121 | COXILHA | AMPLA | www.pmcoxilha.rs.gov.br | gov.br |
| 122 | CRISSIUMAL | AMUCELEIRO | www.crissiumal-rs.com.br | com.br |
| 123 | CRISTAL | ACOSTADOCE | www.cristal.rs.gov.br | gov.br |
| 124 | CRISTAL DO SUL | AMZOP | www.cristaldosul.atende.net | atende.net |
| 125 | CRUZ ALTA | AMAJA | www.cruzalta.atende.net | atende.net |
| 126 | CRUZALTENSE | AMAU | www.cruzaltense.rs.gov.br | gov.br |
| 127 | CRUZEIRO DO SUL | AMVAT | www.cruzeirodosul.rs.gov.br | gov.br |
| 128 | DAVID CANABARRO | AMPLA | www.davidcanabarro.rs.gov.br | gov.br |
| 129 | DERRUBADAS | AMUCELEIRO | www.derrubadas-rs.com.br | com.br |
| 130 | DEZESSEIS DE NOVEMBRO | AMM | www.dezesseisdenovembro.rs.gov.br | gov.br |
| 131 | DILERMANDO DE AGUIAR | AMCENTRO | www.dilermandodeaguiar.rs.gov.br | gov.br |
| 132 | DOIS IRMÃOS | AMVAG | www.doisirmaos.rs.gov.br | gov.br |
| 133 | DOIS IRMÃOS DAS MISSÕES | AMZOP | www.doisirmaosdasmissoes.rs.gov.br | gov.br |
| 134 | DOIS LAJEADOS | AMESNE | www.doislajeados.rs.gov.br | gov.br |
| 135 | DOM FELICIANO | ACOSTADOCE | www.domfeliciano.rs.gov.br | gov.br |
| 136 | DOM PEDRITO | ASSUDOESTE | www.dompedrito.rs.gov.br | gov.br |
| 137 | DOM PEDRO DE ALCÂNTARA | AMLINORTE | www.dompedrodealcantara.rs.gov.br | gov.br |
| 138 | DONA FRANCISCA | AMCENTRO | www.donafrancisca.rs.gov.br | gov.br |
| 139 | DOUTOR MAURÍCIO CARDOSO | AMUFRON | www.pdrmcard.com.br | com.br |
| 140 | DOUTOR RICARDO | AMAT | www.doutorricardo.rs.gov.br | gov.br |
| 141 | ELDORADO DO SUL | GRANPAL | www.eldorado.rs.gov.br | gov.br |
| 142 | ENCANTADO | AMAT | www.encantado.rs.gov.br | gov.br |
| 143 | ENCRUZILHADA DO SUL | AMVARP | www.encruzilhadadosul.rs.gov.br | gov.br |
| 144 | ENGENHO VELHO | AMNG | www.engenhovelho.rs.gov.br | gov.br |
| 145 | ENTRE RIOS DO SUL | AMAU | www.entreriosdosul.rs.gov.br | gov.br |
| 146 | ENTRE-IJUÍS | AMM | www.entreijuis.rs.gov.br | gov.br |
| 147 | EREBANGO | AMAU | www.erebango.rs.gov.br | gov.br |
| 148 | ERECHIM | AMAU | www.pmerechim.rs.gov.br | gov.br |
| 149 | ERNESTINA | AMPLA | www.ernestina.rs.gov.br | gov.br |
| 150 | ERVAL GRANDE | AMAU | www.ervalgrande.rs.gov.br | gov.br |
| 151 | ERVAL SECO | AMZOP | www.ervalseco.rs.gov.br | gov.br |
| 152 | ESMERALDA | AMUCSER | www.esmeralda.rs.gov.br | gov.br |
| 153 | ESPERANÇA DO SUL | AMUCELEIRO | www.esperancadosul.rs.gov.br | gov.br |
| 154 | ESPUMOSO | AMASBI | www.espumoso.rs.gov.br | gov.br |
| 155 | ESTAÇÃO | AMAU | www.pmestacao.rs.gov.br | gov.br |
| 156 | ESTÂNCIA VELHA | AMVAG | www.estanciavelha.rs.gov.br | gov.br |
| 157 | ESTEIO | GRANPAL | www.esteio.rs.gov.br | gov.br |
| 158 | ESTRELA | AMVAT | www.estrela.rs.gov.br | gov.br |
| 159 | ESTRELA VELHA | AMCSERRA | www.estrelavelha.rs.gov.br | gov.br |
| 160 | EUGÊNIO DE CASTRO | AMM | www.eugeniodecastro.rs.gov.br | gov.br |
| 161 | FAGUNDES VARELA | AMESNE | www.fagundesvarela.rs.gov.br | gov.br |
| 162 | FARROUPILHA | AMESNE | www.farroupilha.rs.gov.br | gov.br |
| 163 | FAXINAL DO SOTURNO | AMCENTRO | www.faxinaldosoturno.rs.gov.br | gov.br |
| 164 | FAXINALZINHO | AMAU | www.faxinalzinho.rs.gov.br | gov.br |
| 165 | FAZENDA VILANOVA | AMVAT | www.fazendavilanova.rs.gov.br | gov.br |
| 166 | FELIZ | AMVARC | www.feliz.rs.gov.br | gov.br |
| 167 | FLORES DA CUNHA | AMESNE | www.floresdacunha.rs.gov.br | gov.br |
| 168 | FLORIANO PEIXOTO | AMAU | www.florianopeixoto.rs.gov.br | gov.br |
| 169 | FONTOURA XAVIER | AMASBI | www.fontouraxavier.rs.gov.br | gov.br |
| 170 | FORMIGUEIRO | AMCENTRO | www.formigueiro.rs.gov.br | gov.br |
| 171 | FORQUETINHA | AMVAT | www.forquetinha.rs.gov.br | gov.br |
| 172 | FORTALEZA DOS VALOS | AMAJA | www.pmfv.rs.gov.br | gov.br |
| 173 | FREDERICO WESTPHALEN | AMZOP | www.fredericowestphalen.rs.gov.br | gov.br |
| 174 | GARIBALDI | AMESNE | www.garibaldi.rs.gov.br | gov.br |
| 175 | GARRUCHOS | AMM | www.garruchos.rs.gov.br | gov.br |
| 176 | GAURAMA | AMAU | www.gaurama.rs.gov.br | gov.br |
| 177 | GENERAL CÂMARA | ASMURC | www.generalcamara.rs.gov.br | gov.br |
| 178 | GENTIL | AMPLA | www.pmgentil.com.br | com.br |
| 179 | GETÚLIO VARGAS | AMAU | www.pmgv.rs.gov.br | gov.br |
| 180 | GIRUÁ | AMM | www.girua.rs.gov.br | gov.br |
| 181 | GLORINHA | GRANPAL | www.glorinha.rs.gov.br | gov.br |
| 182 | GRAMADO | AMSERRA | www.gramado.atende.net | atende.net |
| 183 | GRAMADO DOS LOUREIROS | AMNG | www.gramadodosloureiros.rs.gov.br | gov.br |
| 184 | GRAMADO XAVIER | AMVARP | gramadoxavier.atende.net | atende.net |
| 185 | GRAVATAÍ | GRANPAL | www.gravatai.atende.net | atende.net |
| 186 | GUABIJU | AMESNE | www.guabiju.rs.gov.br | gov.br |
| 187 | GUAÍBA | GRANPAL | www.guaiba.atende.net | atende.net |
| 188 | GUAPORÉ | AMESNE | www.guapore.rs.gov.br | gov.br |
| 189 | GUARANI DAS MISSÕES | AMM | www.guaranidasmissoes.rs.gov.br | gov.br |
| 190 | HARMONIA | AMVARC | www.harmonia.rs.gov.br | gov.br |
| 191 | HERVAL | AZONASUL | www.herval.rs.gov.br | gov.br |
| 192 | HERVEIRAS | AMVARP | www.herveiras.rs.gov.br | gov.br |
| 193 | HORIZONTINA | AMUFRON | www.horizontina.atende.net | atende.net |
| 194 | HULHA NEGRA | AZONASUL | www.hulhanegra.rs.gov.br | gov.br |
| 195 | HUMAITÁ | AMUCELEIRO | www.humaita.rs.gov.br | gov.br |
| 196 | IBARAMA | AMCSERRA | www.ibarama.rs.gov.br | gov.br |
| 197 | IBIAÇÁ | AMUNOR | www.ibiaca.rs.gov.br | gov.br |
| 198 | IBIRAIARAS | AMUNOR | www.ibiraiaras.rs.gov.br | gov.br |
| 199 | IBIRAPUITÃ | AMASBI | www.ibirapuita.rs.gov.br | gov.br |
| 200 | IBIRUBÁ | AMAJA | www.ibiruba.rs.gov.br | gov.br |
| 201 | IGREJINHA | AMPARA | www.igrejinha.rs.gov.br | gov.br |
| 202 | IJUÍ | AMUPLAM | www.ijui.rs.gov.br | gov.br |
| 203 | ILÓPOLIS | AMVAT | www.ilopolis.rs.gov.br | gov.br |
| 204 | IMBÉ | AMLINORTE | www imbe.rs.gov.br | gov.br |
| 205 | IMIGRANTE | AMVAT | www.imigrante-rs.com.br | com.br |
| 206 | INDEPENDÊNCIA | AMUFRON | www.independencia.rs.gov.br | gov.br |
| 207 | INHACORÁ | AMUCELEIRO | www.inhacora.atende.net | atende.net |
| 208 | IPÊ | AMUCSER | www.pmipe.rs.gov.br | gov.br |
| 209 | IPIRANGA DO SUL | AMAU | www.ipirangadosul.rs.gov.br | gov.br |
| 210 | IRAÍ | AMZOP | www.irai.rs.gov.br | gov.br |
| 211 | ITAARA | AMCENTRO | www.itaara.rs.gov.br | gov.br |
| 212 | ITACURUBI | AMM | www.itacurubi.rs.gov.br | gov.br |
| 213 | ITAPUCA | AMAT | www.itapuca.rs.gov.br | gov.br |
| 214 | ITAQUI | AMFRO | www.itaqui.rs.gov.br | gov.br |
| 215 | ITATI | AMLINORTE | www.itati.rs.gov.br | gov.br |
| 216 | ITATIBA DO SUL | AMAU | www.itatibadosul.rs.gov.br | gov.br |
| 217 | IVORÁ | AMCENTRO | www.ivora.rs.gov.br | gov.br |
| 218 | IVOTI | AMVAG | www.ivoti.rs.gov.br | gov.br |
| 219 | JABOTICABA | AMZOP | www.jaboticaba.atende.net | atende.net |
| 220 | JACUIZINHO | AMCSERRA | www.jacuizinho.rs.gov.br | gov.br |
| 221 | JACUTINGA | AMAU | www.jacutinga.rs.gov.br | gov.br |
| 222 | JAGUARÃO | AZONASUL | www.jaguarao.rs.gov.br | gov.br |
| 223 | JAGUARI | AMCENTRO | www.jaguari.rs.gov.br | gov.br |
| 224 | JAQUIRANA | AMUCSER | www.jaquirana.rs.gov.br | gov.br |
| 225 | JARI | AMCENTRO | www.jari.rs.gov.br | gov.br |
| 226 | JÓIA | AMUPLAM | www.joia.rs.gov.br | gov.br |
| 227 | JÚLIO DE CASTILHOS | AMCENTRO | www.juliodecastilhos.rs.gov.br | gov.br |
| 228 | LAGOA BONITA DO SUL | AMCSERRA | www.lagoabonitadosul.atende.net | atende.net |
| 229 | LAGOA DOS TRÊS CANTOS | AMAJA | www.lagoa3cantos.rs.gov.br | gov.br |
| 230 | LAGOA VERMELHA | AMUNOR | www.lagoavermelha.atende.net | atende.net |
| 231 | LAGOÃO | AMCSERRA | www.lagoao.rs.gov.br | gov.br |
| 232 | LAJEADO | AMVAT | www.lajeado.rs.gov.br | gov.br |
| 233 | LAJEADO DO BUGRE | AMZOP | www.lajeadodobugre.rs.gov.br | gov.br |
| 234 | LAVRAS DO SUL | ASSUDOESTE | www.lavrasdosul.rs.gov.br | gov.br |
| 235 | LIBERATO SALZANO | AMZOP | www.liberatosalzano.rs.gov.br | gov.br |
| 236 | LINDOLFO COLLOR | AMVAG | www.lindolfocollor.rs.gov.br | gov.br |
| 237 | LINHA NOVA | AMVARC | www.linhanova.rs.gov.br | gov.br |
| 238 | MAÇAMBARÁ | AMFRO | www.macambara.atende.net | atende.net |
| 239 | MACHADINHO | AMUNOR | www.machadinho.rs.gov.br | gov.br |
| 240 | MAMPITUBA | AMLINORTE | www.mampituba.rs.gov.br | gov.br |
| 241 | MANOEL VIANA | AMFRO | www.manoelviana.rs.gov.br | gov.br |
| 242 | MAQUINÉ | AMLINORTE | www.maquine.rs.gov.br | gov.br |
| 243 | MARATÁ | AMVARC | www.marata.rs.gov.br | gov.br |
| 244 | MARAU | AMPLA | www.pmmarau.com.br | com.br |
| 245 | MARCELINO RAMOS | AMAU | www.marcelinoramos.rs.gov.br | gov.br |
| 246 | MARIANA PIMENTEL | ACOSTADOCE | www.marianapimentel.rs.gov.br | gov.br |
| 247 | MARIANO MORO | AMAU | www.marianomoro.rs.gov.br | gov.br |
| 248 | MARQUES DE SOUZA | AMVAT | www.marquesdesouza.rs.gov.br | gov.br |
| 249 | MATA | AMCENTRO | www.mata.rs.gov.br | gov.br |
| 250 | MATO CASTELHANO | AMPLA | www.matocastelhano.rs.gov.br | gov.br |
| 251 | MATO LEITÃO | AMVARP | www.matoleitao.rs.gov.br | gov.br |
| 252 | MATO QUEIMADO | AMM | www.matoqueimado-rs.com.br | com.br |
| 253 | MAXIMILIANO DE ALMEIDA | AMUNOR | www.maximilianodealmeida.rs.gov.br | gov.br |
| 254 | MINAS DO LEÃO | ASMURC | www.minasdoleao.rs.gov.br | gov.br |
| 255 | MIRAGUAI | AMUCELEIRO | www.miraguai.rs.gov.br | gov.br |
| 256 | MONTAURI | AMESNE | www.montauri.rs.gov.br | gov.br |
| 257 | MONTE ALEGRE DOS CAMPOS | AMUCSER | www.montealegredoscampos.rs.gov.br | gov.br |
| 258 | MONTE BELO DO SUL | AMESNE | www.montebelodosul.rs.gov.br | gov.br |
| 259 | MONTENEGRO | AMVARC | www.montenegro.rs.gov.br | gov.br |
| 260 | MORMAÇO | AMASBI | www.mormaco.rs.gov.br | gov.br |
| 261 | MORRINHOS DO SUL | AMLINORTE | www.morrinhosdosul.rs.gov.br | gov.br |
| 262 | MORRO REDONDO | AZONASUL | www.morroredondo.rs.gov.br | gov.br |
| 263 | MORRO REUTER | AMVAG | www.morroreuter.rs.gov.br | gov.br |
| 264 | MOSTARDAS | AMLINORTE | www.mostardas.rs.gov.br | gov.br |
| 265 | MUÇUM | AMAT | www.mucum.rs.gov.br | gov.br |
| 266 | MUITOS CAPÕES | AMUCSER | www.muitoscapoes.rs.gov.br | gov.br |
| 267 | MULITERNO | AMPLA | www.muliterno.rs.gov.br | gov.br |
| 268 | NÃO-ME-TOQUE | AMAJA | www.naometoque.rs.gov.br | gov.br |
| 269 | NICOLAU VERGUEIRO | AMPLA | www.nicolauvergueiro.rs.gov.br | gov.br |
| 270 | NONOAI | AMNG | www.nonoai.rs.gov.br | gov.br |
| 271 | NOVA ALVORADA | AMPLA | www.novaalvorada.rs.gov.br | gov.br |
| 272 | NOVA ARAÇÁ | AMESNE | www.novaaraca.rs.gov.br | gov.br |
| 273 | NOVA BASSANO | AMESNE | www.novabassano.rs.gov.br | gov.br |
| 274 | NOVA BOA VISTA | AMNG | www.novaboavista.rs.gov.br | gov.br |
| 275 | NOVA BRÉSCIA | AMAT | www.novabrescia.rs.gov.br | gov.br |
| 276 | NOVA CANDELÁRIA | AMUFRON | www.novacandelaria.rs.gov.br | gov.br |
| 277 | NOVA ESPERANÇA DO SUL | AMCENTRO | www.novaesperancadosul.rs.gov.br | gov.br |
| 278 | NOVA HARTZ | AMVAG | www.novahartz.rs.gov.br | gov.br |
| 279 | NOVA PÁDUA | AMESNE | www.novapadua.rs.gov.br | gov.br |
| 280 | NOVA PALMA | AMCENTRO | www.novapalma.rs.gov.br | gov.br |
| 281 | NOVA PETRÓPOLIS | AMSERRA | www.novapetropolis.rs.gov.br | gov.br |
| 282 | NOVA PRATA | AMESNE | www.novaprata.rs.gov.br | gov.br |
| 283 | NOVA RAMADA | AMUPLAM | www.novaramada.rs.gov.br | gov.br |
| 284 | NOVA ROMA DO SUL | AMESNE | www.novaromadosul.rs.gov.br | gov.br |
| 285 | NOVA SANTA RITA | GRANPAL | www.novasantarita.atende.net | atende.net |
| 286 | NOVO BARREIRO | AMZOP | www.novobarreiro.rs.gov.br | gov.br |
| 287 | NOVO CABRAIS | AMCSERRA | www.novocabrais.rs.gov.br | gov.br |
| 288 | NOVO HAMBURGO | GRANPAL | www.novohamburgo.rs.gov.br | gov.br |
| 289 | NOVO MACHADO | AMUFRON | www.novomachado.rs.gov.br | gov.br |
| 290 | NOVO TIRADENTES | AMZOP | www.novotiradentesrs.com.br | com.br |
| 291 | NOVO XINGU | AMZOP | www.novoxingu.rs.gov.br | gov.br |
| 292 | OSÓRIO | AMLINORTE | www.osorio.rs.gov.br | gov.br |
| 293 | PAIM FILHO | AMUNOR | www.paimfilho.rs.gov.br | gov.br |
| 294 | PALMARES DO SUL | AMLINORTE | www.palmaresdosul.rs.gov.br | gov.br |
| 295 | PALMEIRA DAS MISSÕES | AMZOP | www.palmeiradasmissoes.atende.net | atende.net |
| 296 | PALMITINHO | AMZOP | www.palmitinho.atende.net | atende.net |
| 297 | PANAMBI | AMUPLAM | www.panambi.atende.net | atende.net |
| 298 | PANTANO GRANDE | AMVARP | www.pantanogrande.rs.gov.br | gov.br |
| 299 | PARAÍ | AMESNE | www.parai.rs.gov.br | gov.br |
| 300 | PARAÍSO DO SUL | AMCENTRO | www.paraisodosul.rs.gov.br | gov.br |
| 301 | PARECI NOVO | AMVARC | www.parecinovo.rs.gov.br | gov.br |
| 302 | PAROBÉ | AMPARA | www.parobe.atende.net | atende.net |
| 303 | PASSA SETE | AMCSERRA | www.passasete.rs.gov.br | gov.br |
| 304 | PASSO DO SOBRADO | AMVARP | www.passodosobrado.rs.gov.br | gov.br |
| 305 | PASSO FUNDO | AMPLA | www.pmpf.rs.gov.br | gov.br |
| 306 | PAULO BENTO | AMAU | www.paulobento.rs.gov.br | gov.br |
| 307 | PAVERAMA | AMVAT | www.paverama.rs.gov.br | gov.br |
| 308 | PEDRAS ALTAS | AZONASUL | www.pedrasaltas.rs.gov.br | gov.br |
| 309 | PEDRO OSÓRIO | ACOSTADOCE | www.pedroosorio.rs.gov.br | gov.br |
| 310 | PEJUÇARA | AMUPLAM | www.pejucara.rs.gov.br | gov.br |
| 311 | PELOTAS | AZONASUL | www.pelotas.com.br | com.br |
| 312 | PICADA CAFÉ | AMSERRA | www.picadacafe.rs.gov.br | gov.br |
| 313 | PINHAL | AMZOP | www.pinhal.atende.net | atende.net |
| 314 | PINHAL DA SERRA | AMUCSER | www.pinhaldaserra.rs.gov.br | gov.br |
| 315 | PINHAL GRANDE | AMCENTRO | www.pinhalgrande.rs.gov.br | gov.br |
| 316 | PINHEIRINHO DO VALE | AMZOP | www.pinheirinhodovale.rs.gov.br | gov.br |
| 317 | PINHEIRO MACHADO | AZONASUL | www.pinheiromachado.rs.gov.br | gov.br |
| 318 | PINTO BANDEIRA | AMESNE | www.pintobandeira.rs.gov.br | gov.br |
| 319 | PIRAPÓ | AMM | www.pirapo.rs.gov.br | gov.br |
| 320 | PIRATINI | AZONASUL | www.prefeiturapiratini.rs.gov.br | gov.br |
| 321 | PLANALTO | AMNG | www.planalto.rs.gov.br | gov.br |
| 322 | POÇO DAS ANTAS | AMVAT | www.pocodasantas.rs.gov.br | gov.br |
| 323 | PONTÃO | AMNG | www.pontao.rs.gov.br | gov.br |
| 324 | PONTE PRETA | AMAU | www.pontepreta.rs.gov.br | gov.br |
| 325 | PORTÃO | AMVARC | www.portao.rs.gov.br | gov.br |
| 326 | PORTO ALEGRE | GRANPAL | www.prefeitura.poa.br | other |
| 327 | PORTO LUCENA | AMUFRON | www.portolucena.rs.gov.br | gov.br |
| 328 | PORTO MAUÁ | AMUFRON | www.portomaua.rs.gov.br | gov.br |
| 329 | PORTO VERA CRUZ | AMUFRON | www.portoveracruz.rs.gov.br | gov.br |
| 330 | PORTO XAVIER | AMM | www.portoxavier.rs.gov.br | gov.br |
| 331 | POUSO NOVO | AMVAT | www.pousonovo.rs.gov.br | gov.br |
| 332 | PRESIDENTE LUCENA | AMVAG | www.presidentelucena.rs.gov.br | gov.br |
| 333 | PROGRESSO | AMVAT | www.progresso.rs.gov.br | gov.br |
| 334 | PROTÁSIO ALVES | AMESNE | www.protasioalves.rs.gov.br | gov.br |
| 335 | PUTINGA | AMVAT | www.putinga.rs.gov.br | gov.br |
| 336 | QUARAÍ | AMFRO | www.quarai.rs.gov.br | gov.br |
| 337 | QUATRO IRMÃOS | AMAU | www.quatroirmaos.rs.gov.br | gov.br |
| 338 | QUEVEDOS | AMCENTRO | www.quevedos.rs.gov.br | gov.br |
| 339 | QUINZE DE NOVEMBRO | AMAJA | www.quinzedenovembro.rs.gov.br | gov.br |
| 340 | REDENTORA | AMUCELEIRO | www.redentora.rs.gov.br | gov.br |
| 341 | RELVADO | AMAT | www.relvado.rs.gov.br | gov.br |
| 342 | RESTINGA SÊCA | AMCENTRO | www.restingaseca.rs.gov.br | gov.br |
| 343 | RIO DOS ÍNDIOS | AMNG | www.riodosindios.rs.gov.br | gov.br |
| 344 | RIO GRANDE | AZONASUL | www.riogrande.rs.gov.br | gov.br |
| 345 | RIO PARDO | AMVARP | www.riopardo.rs.gov.br | gov.br |
| 346 | RIOZINHO | AMPARA | www.pmriozinho.rs.gov.br | gov.br |
| 347 | ROCA SALES | AMAT | www.rocasales-rs.com.br | com.br |
| 348 | RODEIO BONITO | AMZOP | www.rodeiobonito.rs.gov.br | gov.br |
| 349 | ROLADOR | AMM | www.rolador.rs.gov.br | gov.br |
| 350 | ROLANTE | AMPARA | www.rolante.atende.net | atende.net |
| 351 | RONDA ALTA | AMNG | www.rondaalta.rs.gov.br | gov.br |
| 352 | RONDINHA | AMNG | www.rondinha.rs.gov.br | gov.br |
| 353 | ROQUE GONZALES | AMM | www.roquegonzales.rs.gov.br | gov.br |
| 354 | ROSÁRIO DO SUL | AMFRO | www.rosariodosul.rs.gov.br | gov.br |
| 355 | SAGRADA FAMÍLIA | AMZOP | www.sagradafamilia.rs.gov.br | gov.br |
| 356 | SALDANHA MARINHO | AMAJA | www.saldanhamarinho.rs.gov.br | gov.br |
| 357 | SALTO DO JACUÍ | AMAJA | www.saltodojacui.rs.gov.br | gov.br |
| 358 | SALVADOR DAS MISSÕES | AMM | www.salvadordasmissoes.rs.gov.br | gov.br |
| 359 | SALVADOR DO SUL | AMVARC | www.salvadordosul.rs.gov.br | gov.br |
| 360 | SANANDUVA | AMUNOR | www.sananduva.rs.com.br | com.br |
| 361 | SANTA BÁRBARA DO SUL | AMAJA | www.santabarbaradosul.rs.gov.br | gov.br |
| 362 | SANTA CECÍLIA DO SUL | AMUNOR | www.santaceciliadosul.rs.gov.br | gov.br |
| 363 | SANTA CLARA DO SUL | AMVAT | www.santaclaradosul.rs.gov.br | gov.br |
| 364 | SANTA CRUZ DO SUL | AMVARP | www.santacruz.rs.gov.br | gov.br |
| 365 | SANTA MARGARIDA DO SUL | AMFRO | www.santamargaridadosul.rs.gov.br | gov.br |
| 366 | SANTA MARIA | AMCENTRO | www.santamaria.rs.gov.br | gov.br |
| 367 | SANTA MARIA DO HERVAL | AMSERRA | www.santamariadoherval.rs.gov.br | gov.br |
| 368 | SANTA ROSA | AMUFRON | www.prefeiturasantarosa.rs.gov.br | gov.br |
| 369 | SANTA TEREZA | AMESNE | www.santatereza.rs.gov.br | gov.br |
| 370 | SANTA VITÓRIA DO PALMAR | AZONASUL | www.santavitoriadopalmar.rs.gov.br | gov.br |
| 371 | SANTANA DA BOA VISTA | AZONASUL | www.santanadaboavista.rs.gov.br | gov.br |
| 372 | SANTANA DO LIVRAMENTO | AMFRO | www.sdolivramento.com.br | com.br |
| 373 | SANTIAGO | AMCENTRO | www.santiago.rs.gov.br | gov.br |
| 374 | SANTO ÂNGELO | AMM | www.santoangelo.rs.gov.br | gov.br |
| 375 | SANTO ANTÔNIO DA PATRULHA | GRANPAL | www.santoantoniodapatrulha.rs.gov.br | gov.br |
| 376 | SANTO ANTÔNIO DAS MISSÕES | AMM | www.santoantoniodasmissoes.rs.gov.br | gov.br |
| 377 | SANTO ANTÔNIO DO PALMA | AMPLA | www.pmpalma.com.br | com.br |
| 378 | SANTO ANTÔNIO DO PLANALTO | AMAJA | www.santoantoniodoplanalto.rs.gov.br | gov.br |
| 379 | SANTO AUGUSTO | AMUCELEIRO | www.santoaugusto.rs.gov.br | gov.br |
| 380 | SANTO CRISTO | AMUFRON | www.santocristo.rs.gov.br | gov.br |
| 381 | SANTO EXPEDITO DO SUL | AMUNOR | www.santoexpeditodosul.rs.gov.br | gov.br |
| 382 | SÃO BORJA | AMFRO | www.saoborja.rs.gov.br | gov.br |
| 383 | SÃO DOMINGOS DO SUL | AMPLA | www.saodomingosdosul.rs.gov.br | gov.br |
| 384 | SÃO FRANCISCO DE ASSIS | AMCENTRO | www.saofranciscodeassis.rs.gov.br | gov.br |
| 385 | SÃO FRANCISCO DE PAULA | AMSERRA | www.saofranciscodepaula.rs.gov.br | gov.br |
| 386 | SÃO GABRIEL | AMFRO | www.saogabriel.rs.gov.br | gov.br |
| 387 | SÃO JERÔNIMO | ASMURC | www.saojeronimo.rs.gov.br | gov.br |
| 388 | SÃO JOÃO DA URTIGA | AMUNOR | www.saojoaodaurtiga.rs.gov.br | gov.br |
| 389 | SÃO JOÃO DO POLÊSINE | AMCENTRO | www.saojoaodopolesine.rs.gov.br | gov.br |
| 390 | SÃO JORGE | AMESNE | www.saojorge.rs.gov.br | gov.br |
| 391 | SÃO JOSÉ DAS MISSÕES | AMZOP | www.saojosedasmissoes.rs.gov.br | gov.br |
| 392 | SÃO JOSÉ DO HERVAL | AMASBI | www.saojosedoherval.rs.gov.br | gov.br |
| 393 | SÃO JOSÉ DO HORTÊNCIO | AMVAG | www.saojosedohortencio.rs.gov.br | gov.br |
| 394 | SÃO JOSÉ DO INHACORÁ | AMUFRON | www.saojosedoinhacora.rs.gov.br | gov.br |
| 395 | SÃO JOSÉ DO NORTE | AZONASUL | www.saojosedonorte.rs.gov.br | gov.br |
| 396 | SÃO JOSÉ DO OURO | AMUNOR | www.saojosedoouro.rs.gov.br | gov.br |
| 397 | SÃO JOSÉ DO SUL | AMVARC | www.saojosedosul.rs.gov.br | gov.br |
| 398 | SÃO JOSÉ DOS AUSENTES | AMUCSER | www.saojosedosausentes.rs.gov.br | gov.br |
| 399 | SÃO LEOPOLDO | AMVAG | www.saoleopoldo.rs.gov.br | gov.br |
| 400 | SÃO LOURENÇO DO SUL | AZONASUL | www.saolourencodosul.rs.gov.br | gov.br |
| 401 | SÃO LUIZ GONZAGA | AMM | www.saoluizgonzaga.rs.gov.br | gov.br |
| 402 | SÃO MARCOS | AMESNE | www.saomarcos.rs.gov.br | gov.br |
| 403 | SÃO MARTINHO | AMUCELEIRO | www.saomartinho.rs.gov.br | gov.br |
| 404 | SÃO MARTINHO DA SERRA | AMCENTRO | www.saomartinhodaserra.rs.gov.br | gov.br |
| 405 | SÃO MIGUEL DAS MISSÕES | AMM | www.saomiguel.rs.gov.br | gov.br |
| 406 | SÃO NICOLAU | AMM | www.saonicolau.rs.gov.br | gov.br |
| 407 | SÃO PAULO DAS MISSÕES | AMM | www.saopaulodasmissoes.rs.gov.br | gov.br |
| 408 | SÃO PEDRO DA SERRA | AMVARC | www.saopedrodaserra.rs.gov.br | gov.br |
| 409 | SÃO PEDRO DAS MISSÕES | AMZOP | www.saopedrodasmissoes.rs.gov.br | gov.br |
| 410 | SÃO PEDRO DO BUTIÁ | AMM | www.saopedrodobutia.rs.gov.br | gov.br |
| 411 | SÃO PEDRO DO SUL | AMCENTRO | www.saopedrodosul.rs.gov.br | gov.br |
| 412 | SÃO SEBASTIÃO DO CAÍ | AMVARC | www.saosebastiaodocai.rs.gov.br | gov.br |
| 413 | SÃO SEPÉ | AMCENTRO | www.saosepe.atende.net | atende.net |
| 414 | SÃO VALENTIM | AMAU | www.saovalentim.rs.gov.br | gov.br |
| 415 | SÃO VALENTIM DO SUL | AMESNE | www.saovalentimdosul.rs.gov.br | gov.br |
| 416 | SÃO VALÉRIO DO SUL | AMUCELEIRO | www.saovaleriodosul.rs.gov.br | gov.br |
| 417 | SÃO VENDELINO | AMVARC | www.saovendelino.rs.gov.br | gov.br |
| 418 | SÃO VICENTE DO SUL | AMCENTRO | www.saovicentedosul.rs.gov.br | gov.br |
| 419 | SAPIRANGA | AMVAG | www.sapiranga.atende.net | atende.net |
| 420 | SAPUCAIA DO SUL | GRANPAL | www.sapucaiadosul.rs.gov.br | gov.br |
| 421 | SARANDI | AMZOP | www.sarandi.rs.gov.br | gov.br |
| 422 | SEBERI | AMZOP | www.seberi.atende.net | atende.net |
| 423 | SEDE NOVA | AMUCELEIRO | www.sedenova.atende.net | atende.net |
| 424 | SEGREDO | AMCSERRA | www.segredo.rs.gov.br | gov.br |
| 425 | SELBACH | AMAJA | www.selbach.rs.gov.br | gov.br |
| 426 | SENADOR SALGADO FILHO | AMUFRON | senadorsalgadofilho.atende.net | atende.net |
| 427 | SENTINELA DO SUL | ACOSTADOCE | www.sentineladosul.rs.gov.br | gov.br |
| 428 | SERAFINA CORRÊA | AMESNE | www.serafinacorrea.rs.gov.br | gov.br |
| 429 | SÉRIO | AMVAT | www.serio.rs.gov.br | gov.br |
| 430 | SERTÃO | AMAU | www.sertao.rs.gov.br | gov.br |
| 431 | SERTÃO SANTANA | ACOSTADOCE | www.sertaosantana.rs.gov.br | gov.br |
| 432 | SETE DE SETEMBRO | AMM | www.setedesetembro.rs.gov.br | gov.br |
| 433 | SEVERIANO DE ALMEIDA | AMAU | www.severianodealmeida.rs.gov.br | gov.br |
| 434 | SILVEIRA MARTINS | AMCENTRO | www.silveiramartins.rs.gov.br | gov.br |
| 435 | SINIMBU | AMVARP | www.sinimbu.rs.gov.br | gov.br |
| 436 | SOBRADINHO | AMCSERRA | www.sobradinho.rs.gov.br | gov.br |
| 437 | SOLEDADE | AMASBI | www.soledade.rs.gov.br | gov.br |
| 438 | TABAÍ | AMVAT | www.tabai.rs.gov.br | gov.br |
| 439 | TAPEJARA | AMUNOR | www.tapejara.rs.gov.br | gov.br |
| 440 | TAPERA | AMAJA | www.tapera.rs.gov.br | gov.br |
| 441 | TAPES | ACOSTADOCE | www.tapes.rs.gov.br | gov.br |
| 442 | TAQUARA | AMPARA | www.taquara.rs.gov.br | gov.br |
| 443 | TAQUARI | AMVAT | www.taquari.rs.gov.br | gov.br |
| 444 | TAQUARUÇU DO SUL | AMZOP | www.taquarucudosul.rs.gov.br | gov.br |
| 445 | TAVARES | AMLINORTE | www.tavares.rs.gov.br | gov.br |
| 446 | TENENTE PORTELA | AMUCELEIRO | www.tenenteportela.rs.gov.br | gov.br |
| 447 | TERRA DE AREIA | AMLINORTE | www.terradeareia.rs.gov.br | gov.br |
| 448 | TEUTÔNIA | AMVAT | www.teutonia.rs.gov.br | gov.br |
| 449 | TIO HUGO | AMASBI | www.tiohugo.rs.gov.br | gov.br |
| 450 | TIRADENTES DO SUL | AMUCELEIRO | www.tiradentesdosul.rs.gov.br | gov.br |
| 451 | TOROPI | AMCENTRO | www.toropi.rs.gov.br | gov.br |
| 452 | TORRES | AMLINORTE | www.torres.rs.gov.br | gov.br |
| 453 | TRAMANDAÍ | AMLINORTE | www.tramandai.rs.gov.br | gov.br |
| 454 | TRAVESSEIRO | AMVAT | www.travesseiro.rs.gov.br | gov.br |
| 455 | TRÊS ARROIOS | AMAU | www.tresarroios.rs.gov.br | gov.br |
| 456 | TRÊS CACHOEIRAS | AMLINORTE | www.trescachoeiras.rs.gov.br | gov.br |
| 457 | TRÊS COROAS | AMPARA | www.trescoroas.rs.gov.br | gov.br |
| 458 | TRÊS DE MAIO | AMUFRON | www.tresdemaio.rs.gov.br | gov.br |
| 459 | TRÊS FORQUILHAS | AMLINORTE | www.tresforquilhas.rs.gov.br | gov.br |
| 460 | TRÊS PALMEIRAS | AMNG | www.trespalmeiras.rs.gov.br | gov.br |
| 461 | TRÊS PASSOS | AMUCELEIRO | www.trespassos.rs.gov.br | gov.br |
| 462 | TRINDADE DO SUL | AMNG | www.trindadedosul.rs.gov.br | gov.br |
| 463 | TRIUNFO | GRANPAL | www.triunfo.rs.gov.br | gov.br |
| 464 | TUCUNDUVA | AMUFRON | www.tucunduva.rs.gov.br | gov.br |
| 465 | TUNAS | AMCSERRA | www.tunas.rs.gov.br | gov.br |
| 466 | TUPANCI DO SUL | AMUNOR | www.tupancidosul.rs.gov.br | gov.br |
| 467 | TUPANCIRETÃ | AMCENTRO | www.tupancireta.rs.gov.br | gov.br |
| 468 | TUPANDI | AMVARC | www.tupandi.rs.gov.br | gov.br |
| 469 | TUPARENDI | AMUFRON | www.tuparendi.rs.gov.br | gov.br |
| 470 | TURUÇU | AZONASUL | www.turucu.rs.gov.br | gov.br |
| 471 | UBIRETAMA | AMM | www.ubiretama.rs.gov.br | gov.br |
| 472 | UNIÃO DA SERRA | AMESNE | www.uniaodaserra.rs.gov.br | gov.br |
| 473 | UNISTALDA | AMCENTRO | www.unistalda.rs.gov.br | gov.br |
| 474 | URUGUAIANA | AMFRO | www.uruguaiana.rs.gov.br | gov.br |
| 475 | VACARIA | AMUCSER | www.vacaria.rs.gov.br | gov.br |
| 476 | VALE DO SOL | AMVARP | www.valedosol.rs.gov.br | gov.br |
| 477 | VALE REAL | AMVARC | www.valereal.rs.gov.br | gov.br |
| 478 | VALE VERDE | AMVARP | www.valeverde.rs.gov.br | gov.br |
| 479 | VANINI | AMPLA | www.prefeituradevanini.com.br | com.br |
| 480 | VENÂNCIO AIRES | AMVARP | www.venancioaires.rs.gov.br | gov.br |
| 481 | VERA CRUZ | AMVARP | www.veracruz.rs.gov.br | gov.br |
| 482 | VERANÓPOLIS | AMESNE | www.veranopolis.rs.gov.br | gov.br |
| 483 | VESPASIANO CORRÊA | AMAT | www.vespasianocorrears.com.br | com.br |
| 484 | VIADUTOS | AMAU | www.viadutos.rs.gov.br | gov.br |
| 485 | VIAMÃO | GRANPAL | www.viamao.rs.gov.br | gov.br |
| 486 | VICENTE DUTRA | AMZOP | www.@vicentedutra.rs.gov.br | gov.br |
| 487 | VICTOR GRAEFF | AMASBI | www.victorgraeff.rs.gov.br | gov.br |
| 488 | VILA FLORES | AMESNE | www.vilaflores.rs.gov.br | gov.br |
| 489 | VILA LÂNGARO | AMUNOR | www.vilalangaro.rs.gov.br | gov.br |
| 490 | VILA MARIA | AMPLA | www.vilamaria.rs.gov.br | gov.br |
| 491 | VILA NOVA DO SUL | AMCENTRO | www.vilanovadosul.rs.gov.br | gov.br |
| 492 | VISTA ALEGRE | AMZOP | www.pmvistaalegre.com.br | com.br |
| 493 | VISTA ALEGRE DO PRATA | AMESNE | www.vistalegredoprata.rs.gov.br | gov.br |
| 494 | VISTA GAÚCHA | AMUCELEIRO | www.vistagaucha-rs.com.br | com.br |
| 495 | VITÓRIA DAS MISSÕES | AMM | www.pmvm.rs.gov.br | gov.br |
| 496 | WESTFÁLIA | AMVAT | www.westfalia.rs.gov.br | gov.br |
| 497 | XANGRI-LÁ | AMLINORTE | www.xangrila.rs.gov.br | gov.br |
