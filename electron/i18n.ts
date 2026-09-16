export type Lang = 'ru' | 'en'
type Vars = Record<string, string | number>

// Текущий язык main-процесса. Инициализируется в main.ts из конфига
// и обновляется в config:set — i18n намеренно ни от чего не зависит,
// чтобы тесты и лёгкие модули не тянули electron/settings.
let lang: Lang = 'ru'
export function setLang(l: string | undefined): void { lang = l === 'en' ? 'en' : 'ru' }

const RU: Record<string, string> = {
  // javaRuntime
  'java.rootFail': 'манифест Java runtime недоступен ({status})',
  'java.noRuntime': 'Рантайм Java {major} не найден для этой платформы (есть: {have})',
  'java.fileFail': 'файл Java {url}: {status}',
  'java.dlOkNoBin': 'Java скачалась, но бинарник не найден',
  'java.downloading': 'Качаю Java {major}…',
  'java.installerNeed': 'Системная Java не подходит для установщика — качаю Java {need}…',
  // launcher
  'launch.authlib': 'Качаю authlib-injector для Ely.by…',
  'launch.already': 'Игра уже запущена',
  'launch.shareCacheFail': 'Не смог расшарить кэш: {msg}',
  'launch.stall': 'Всё ещё качаю… если висит долго — проверь интернет или жми Отмена',
  'launch.badVersion': 'Файл версии битый, переустанови загрузчик: {msg}',
  'launch.jarUnreadable': 'Файл версии не читается, переустанови версию',
  'launch.badFileRedl': 'Нашёл битый файл, качаю заново…',
  'launch.downloading': 'Загрузка файлов игры…',
  'launch.prep': 'Подготовка версии…',
  'launch.running': 'Игра запущена',
  'launch.cancelled': 'Запуск отменён',
  'launch.error': 'Ошибка: {msg}',
  // versions
  'ver.mojang': 'Mojang вернул {status}',
  'ver.notFound': 'Версия {v} не найдена',
  'ver.fabricNone': 'Fabric нет для {mc}',
  'ver.fabricProfile': 'Fabric профиль {mc}+{loader} не найден',
  'ver.quiltProfile': 'Quilt профиль {mc}+{loader} не найден',
  'ver.installerDl': 'Скачивание установщика: {status}',
  'ver.installCancelled': 'Установка отменена',
  'ver.installExitCode': 'Установщик завершился с кодом {code}. {tail}',
  'ver.forgeNone': 'Forge не вышел для Minecraft {mc} — выбери Fabric, NeoForge или другую версию игры',
  'ver.neoNone': 'NeoForge не вышел для Minecraft {mc} — выбери Fabric, Forge или другую версию игры',
  'ver.dlForge': 'Скачиваю Forge {v}…',
  'ver.dlNeo': 'Скачиваю NeoForge {v}…',
  'ver.unrecognized': 'Установщик отработал, но версия не опознана — проверь список вручную',
  // ipc misc
  'ipc.noInstance': 'Инстанс не найден',
  'ipc.badNick': 'Ник: 1–16 символов, латиница/цифры/_',
  'ipc.pickVersion': 'Выбери версию в инстансе',
  'ipc.elyExpired': 'Сессия Ely.by истекла',
  'ipc.needNick': 'Укажи ник',
  'ipc.pickJava': 'Выбери java.exe',
  'ipc.pickJar': 'Выбери .jar моды',
  'ipc.jarFilter': 'Моды Minecraft',
  'ipc.needJar': 'Нужны .jar файлы',
  'ipc.badPath': 'Некорректный путь',
  'ipc.noModVersion': 'Нет версии под этот инстанс',
  'ipc.noPackVersion': 'Нет сборки под этот инстанс',
  'ipc.badMrpack': 'Битый .mrpack',
  'ipc.packFiles': 'Файлов сборки: {n} — качаю…',
  'ipc.packProgress': 'Файлы сборки: {done}/{total}',
  'ipc.modVersionFile': 'Файл версии не найден',
  // auth / instances / mods / modrinth / mrpack
  'auth.noProfile': 'У аккаунта Ely.by нет профиля Minecraft',
  'inst.outside': 'Отказ: gameDir вне папки инстансов',
  'mods.notMod': 'Не мод: {f}',
  'mods.needJar': 'Нужен .jar файл: {f}',
  'mods.empty': 'Пустой файл: {f}',
  'modrinth.dl': 'Скачивание: {status}',
  'mrpack.unsafe': 'Опасный путь в сборке: {rel}',
  'mrpack.sha512': 'sha512 не сошёлся — файл битый или подменён',
  'mrpack.sha1': 'sha1 не сошёлся — файл битый или подменён',
  // flags presets
  'flags.standard': 'Стандарт',
  'flags.aikar': 'Производительность (Aikar)',
  'flags.fps': 'Максимум FPS',
  'flags.weak': 'Слабый ПК',
  'flags.custom': 'Свои флаги',
  // discord rpc
  'rpc.idleD': 'Сидит в NEMO',
  'rpc.idleS': 'Выбирает сборку',
  'rpc.launchD': 'Запускает «{name}»',
  'rpc.launchS': 'Загрузка файлов игры…',
  'rpc.playS': 'Играет как {nick}',
  // updater
  'upd.checkFail': 'GitHub не ответил ({status})',
  'upd.noAsset': 'В релизе нет установщика — открой страницу релиза',
}

const EN: Record<string, string> = {
  'java.rootFail': 'Java runtime manifest unavailable ({status})',
  'java.noRuntime': 'Java {major} runtime not found for this platform (have: {have})',
  'java.fileFail': 'Java file {url}: {status}',
  'java.dlOkNoBin': 'Java downloaded but binary missing',
  'java.downloading': 'Downloading Java {major}…',
  'java.installerNeed': 'System Java unsuitable for installer — fetching Java {need}…',
  'launch.authlib': 'Fetching authlib-injector for Ely.by…',
  'launch.already': 'Game already running',
  'launch.shareCacheFail': 'Could not share cache: {msg}',
  'launch.stall': 'Still downloading… if stuck long — check connection or hit Cancel',
  'launch.badVersion': 'Version file broken, reinstall loader: {msg}',
  'launch.jarUnreadable': 'Version file unreadable, reinstall the version',
  'launch.badFileRedl': 'Found broken file, redownloading…',
  'launch.downloading': 'Downloading game files…',
  'launch.prep': 'Preparing version…',
  'launch.running': 'Game launched',
  'launch.cancelled': 'Launch cancelled',
  'launch.error': 'Error: {msg}',
  'ver.mojang': 'Mojang returned {status}',
  'ver.notFound': 'Version {v} not found',
  'ver.fabricNone': 'No Fabric for {mc}',
  'ver.fabricProfile': 'Fabric profile {mc}+{loader} not found',
  'ver.quiltProfile': 'Quilt profile {mc}+{loader} not found',
  'ver.installerDl': 'Installer download: {status}',
  'ver.installCancelled': 'Install cancelled',
  'ver.installExitCode': 'Installer exited with code {code}. {tail}',
  'ver.forgeNone': 'No Forge for Minecraft {mc} — pick Fabric, NeoForge or another game version',
  'ver.neoNone': 'No NeoForge for Minecraft {mc} — pick Fabric, Forge or another game version',
  'ver.dlForge': 'Downloading Forge {v}…',
  'ver.dlNeo': 'Downloading NeoForge {v}…',
  'ver.unrecognized': 'Installer finished but version unrecognized — check the list manually',
  'ipc.noInstance': 'Instance not found',
  'ipc.badNick': 'Nick: 1–16 chars, latin/digits/_',
  'ipc.pickVersion': 'Pick a version in the instance',
  'ipc.elyExpired': 'Ely.by session expired',
  'ipc.needNick': 'Enter a nick',
  'ipc.pickJava': 'Pick java.exe',
  'ipc.pickJar': 'Pick .jar mods',
  'ipc.jarFilter': 'Minecraft mods',
  'ipc.needJar': '.jar files needed',
  'ipc.badPath': 'Bad path',
  'ipc.noModVersion': 'No version for this instance',
  'ipc.noPackVersion': 'No pack for this instance',
  'ipc.badMrpack': 'Broken .mrpack',
  'ipc.packFiles': 'Pack files: {n} — downloading…',
  'ipc.packProgress': 'Pack files: {done}/{total}',
  'ipc.modVersionFile': 'Version file not found',
  'auth.noProfile': 'Ely.by account has no Minecraft profile',
  'inst.outside': 'Refused: gameDir outside instances folder',
  'mods.notMod': 'Not a mod: {f}',
  'mods.needJar': '.jar file needed: {f}',
  'mods.empty': 'Empty file: {f}',
  'modrinth.dl': 'Download: {status}',
  'mrpack.unsafe': 'Unsafe path in pack: {rel}',
  'mrpack.sha512': 'sha512 mismatch — file broken or replaced',
  'mrpack.sha1': 'sha1 mismatch — file broken or replaced',
  'flags.standard': 'Standard',
  'flags.aikar': 'Performance (Aikar)',
  'flags.fps': 'Max FPS',
  'flags.weak': 'Weak PC',
  'flags.custom': 'Custom flags',
  'rpc.idleD': 'Hanging out in NEMO',
  'rpc.idleS': 'Picking a pack',
  'rpc.launchD': 'Launching "{name}"',
  'rpc.launchS': 'Downloading game files…',
  'rpc.playS': 'Playing as {nick}',
  'upd.checkFail': 'GitHub unavailable ({status})',
  'upd.noAsset': 'No installer in release — open the release page',
}

/** Перевод по ключу; неизвестный язык и отсутствующий ключ — fallback на ru/ключ. */
export function t(lang: string | undefined, key: string, vars?: Vars): string {
  const L = lang === 'en' ? EN : RU
  let s = L[key] ?? RU[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

/** Перевод на текущий язык main-процесса. */
export function tl(key: string, vars?: Vars): string {
  return t(lang, key, vars)
}
