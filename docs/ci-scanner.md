# Scanner CI Infinity CodeGuard

Le scanner fonctionne sur le code déjà extrait par Git ou par la CI. Il transmet les résultats normalisés et, pour chaque problème, un court extrait du fichier concerné afin d’afficher le code dans CodeGuard. Il ne transmet pas les fichiers complets. Les lignes contenant des marqueurs courants de secrets sont masquées avant l’envoi et à la réception.

## Préparation

Démarrez Infinity CodeGuard avec Docker Compose. Depuis le dépôt CodeGuard, construisez une fois l’image du scanner :

```sh
docker compose --env-file .env -f infrastructure/docker/compose.yml -f infrastructure/docker/compose.dev.yml build scanner
```

Cette image contient Semgrep et la commande CodeGuard ; aucune installation Semgrep n’est nécessaire sur le Mac.

## Configuration du projet

Créez `codeguard.properties` à la racine du projet analysé :

```properties
codeguard.host.url=http://localhost:3000
codeguard.repository.id=CLE_DU_PROJET_OU_UUID_DU_DEPOT
```

Dans l’espace projet, cliquez sur « Générer un jeton d’analyse » et copiez le jeton affiché une seule fois. Ne mettez jamais ce jeton dans `codeguard.properties` ou dans Git.
La section « Jetons d’analyse » affiche leur préfixe, leur état et le bouton « Révoquer ». La révocation rend immédiatement le jeton inutilisable pour les nouveaux envois ; créez-en un autre pour reprendre les scans. Seuls les administrateurs de l’organisation peuvent gérer ces jetons.

Pour analyser un dossier local, `codeguard.repository.id` peut contenir la clé du projet (par exemple `gbp-5b7b88`) ou être omis. CodeGuard crée alors automatiquement une entrée locale pour ce projet lors du premier scan. Aucune connexion GitHub ni URL Git n’est nécessaire. Si un dépôt est déjà enregistré, vous pouvez mettre son UUID pour y rattacher les analyses.

## Lancement

Depuis le dépôt Infinity CodeGuard, lancez :

```sh
CG_TOKEN="VOTRE_JETON" ./scripts/codeguard-scan /chemin/absolu/vers/le/projet
```

Le projet doit déjà être un dépôt Git extrait localement. Pour un dépôt privé, clonez-le avec vos droits habituels ou laissez la CI l’extraire ; CodeGuard ne demande pas de transmettre vos identifiants Git. Le script monte ce dossier en lecture seule dans le conteneur scanner.

Cette commande lance en une seule exécution :

- les règles de sécurité générales ;
- la détection de secrets ;
- les règles OWASP Top 10 ;
- les contrôles Terraform et Dockerfile.

Le scanner détecte les langages pris en charge présents dans le dépôt. La commande est donc identique pour PHP, Java, JavaScript, TypeScript, Angular et les projets polyglottes.

Pour un scan local, les vulnérabilités affichent le chemin du fichier, les numéros de ligne et un extrait autour de la ligne concernée. Les fichiers de plus de 256 Ko, les liens symboliques sortant du dossier analysé et les extraits dépassant la limite globale du rapport sont omis. Les analyses effectuées avant cette version conservent leur ancien comportement : relancez le scan pour enregistrer les extraits.

L’onglet « Analyses » compare chaque résultat au scan réussi précédent du même dépôt et de la même branche : nouveaux, corrigés, toujours présents et réapparus. Le premier scan sert de référence ; les chiffres sont calculés à partir des empreintes des problèmes, sans fusionner les résultats d’autres projets ou branches.

Un Quality Gate en échec termine la commande avec le code `2`. Une erreur d’exécution ou d’envoi utilise le code `1`.

Sur un checkout CI détaché, renseignez aussi `CG_BRANCH` avec le nom de la branche. Le scanner refuse une branche vide plutôt que d’envoyer un rapport incorrect.

Pour une installation hors Docker, `pnpm --filter @codeguard/scanner build` puis `npm install -g ./scanners/codeguard` installe `codeguard-scan`. Cette variante exige Semgrep dans le `PATH` et utilise la même configuration `codeguard.properties`.
