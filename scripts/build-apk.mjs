// Builds the Android APK with the plain SDK tools (no Gradle): aapt2 → javac → d8 → zipalign → apksigner.
// Toolchain: JAVA_HOME and ANDROID_HOME when set, otherwise the project-local .toolchain folder.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const android = path.join(root, 'android'), release = path.join(root, 'release');
// Windows Android tools need an ASCII staging path even when the project path contains non-ASCII characters.
const ascii = value => /^[\x20-\x7e]+$/.test(value);
const buildRoot = [process.env.TINGDU_ANDROID_BUILD, path.join(root, 'build', 'android'), path.join(os.tmpdir(), 'tingdu-android-build')].find(candidate => candidate && ascii(candidate));
if (!buildRoot) {
  console.error('No ASCII-only build folder available. Set TINGDU_ANDROID_BUILD to a folder such as C:\\tingdu-build.');
  process.exit(1);
}
const exe = name => process.platform === 'win32' ? `${name}.exe` : name;
const jdk = process.env.JAVA_HOME || path.join(root, '.toolchain', 'jdk');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(root, '.toolchain', 'android-sdk');
const newest = directory => existsSync(directory) ? readdirSync(directory).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).at(-1) : undefined;
const buildToolsVersion = newest(path.join(sdk, 'build-tools')), platform = newest(path.join(sdk, 'platforms'));
if (!existsSync(path.join(jdk, 'bin', exe('java'))) || !buildToolsVersion || !platform) {
  console.error(`Android toolchain not found.\n  JDK: ${jdk}\n  SDK: ${sdk}\nSet JAVA_HOME (JDK 17+) and ANDROID_HOME (with build-tools and a platform), or see README.`);
  process.exit(1);
}
// Never clear a caller-supplied folder: each build owns a fresh child directory.
mkdirSync(buildRoot, { recursive: true });
const build = mkdtempSync(path.join(path.resolve(buildRoot), 'run-'));
const tools = path.join(sdk, 'build-tools', buildToolsVersion), androidJar = path.join(build, 'android.jar');
const java = path.join(jdk, 'bin', exe('java')), javac = path.join(jdk, 'bin', exe('javac')), keytool = path.join(jdk, 'bin', exe('keytool'));
const run = (command, args, options = {}) => execFileSync(command, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', ...options });
const files = (directory, pattern) => readdirSync(directory, { recursive: true }).map(name => path.join(directory, String(name))).filter(file => pattern.test(file) && statSync(file).isFile());

const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const [major, minor, patch] = version.split('.').map(Number);
const versionCode = String(major * 10000 + minor * 100 + patch);
console.log(`听读 ${version} (${versionCode}) · build-tools ${buildToolsVersion} · ${platform}`);

for (const directory of ['assets', 'gen', 'classes', 'dex']) mkdirSync(path.join(build, directory), { recursive: true });
// Ship only the page itself, flat at the assets root: aapt2 on Windows names nested assets with backslashes, which Android cannot open.
for (const name of readdirSync(path.join(root, 'web', 'dist')).filter(name => /\.(html|js|css)$/.test(name))) cpSync(path.join(root, 'web', 'dist', name), path.join(build, 'assets', name));
cpSync(path.join(root, 'LICENSE'), path.join(build, 'assets', 'LICENSE.txt'));
cpSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(build, 'assets', 'THIRD_PARTY_NOTICES.md'));
cpSync(path.join(android, 'res'), path.join(build, 'res'), { recursive: true });
cpSync(path.join(android, 'AndroidManifest.xml'), path.join(build, 'AndroidManifest.xml'));
cpSync(path.join(sdk, 'platforms', platform, 'android.jar'), androidJar);

console.log('1/6 Compiling resources');
run(path.join(tools, exe('aapt2')), ['compile', '--dir', path.join(build, 'res'), '-o', path.join(build, 'resources.zip')]);
const unsigned = path.join(build, 'unsigned.apk');
run(path.join(tools, exe('aapt2')), ['link', '-o', unsigned, '-I', androidJar, '--manifest', path.join(build, 'AndroidManifest.xml'), '-A', path.join(build, 'assets'), '--java', path.join(build, 'gen'), '--min-sdk-version', '24', '--target-sdk-version', '35', '--version-code', versionCode, '--version-name', version, path.join(build, 'resources.zip')]);

console.log('2/6 Compiling Java');
// core-lambda-stubs supplies the java.lang.invoke classes that Java 8 lambdas compile against; d8 desugars them.
run(javac, ['-J-Duser.language=en', '-source', '8', '-target', '8', '-bootclasspath', [androidJar, path.join(tools, 'core-lambda-stubs.jar')].join(path.delimiter), '-encoding', 'UTF-8', '-nowarn', '-Xlint:-options', '-d', path.join(build, 'classes'), ...files(path.join(android, 'java'), /\.java$/), ...files(path.join(build, 'gen'), /\.java$/)]);

console.log('3/6 Converting to dex');
run(java, ['-cp', path.join(tools, 'lib', 'd8.jar'), 'com.android.tools.r8.D8', '--release', '--min-api', '24', '--lib', androidJar, '--output', path.join(build, 'dex'), ...files(path.join(build, 'classes'), /\.class$/)]);
run(path.join(tools, exe('aapt')), ['add', unsigned, 'classes.dex'], { cwd: path.join(build, 'dex') });

console.log('4/6 Aligning');
const aligned = path.join(build, 'aligned.apk');
run(path.join(tools, exe('zipalign')), ['-f', '-p', '4', unsigned, aligned]);

// The release key is created once and must be kept: Android only installs updates signed with the same key.
console.log('5/6 Signing');
const signing = path.join(android, 'signing'), keystore = path.join(signing, 'tingdu-release.p12'), secret = path.join(signing, 'keystore-password.txt');
if (!existsSync(keystore)) {
  mkdirSync(signing, { recursive: true });
  writeFileSync(secret, randomBytes(24).toString('base64url'), { mode: 0o600 });
  run(keytool, ['-genkeypair', '-keystore', keystore, '-storetype', 'PKCS12', '-storepass:file', secret, '-alias', 'tingdu', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=Tingdu, O=Tingdu, C=CN']);
  console.log(`   Created signing key ${path.relative(root, keystore)} — back up this folder; updates need the same key.`);
}
const signed = path.join(build, 'signed.apk');
run(java, ['-jar', path.join(tools, 'lib', 'apksigner.jar'), 'sign', '--ks', keystore, '--ks-pass', `file:${secret}`, '--ks-key-alias', 'tingdu', '--min-sdk-version', '24', '--out', signed, aligned]);

console.log('6/6 Verifying');
const verified = run(java, ['-jar', path.join(tools, 'lib', 'apksigner.jar'), 'verify', '--verbose', '--print-certs', signed]);
if (!/Verified using v2 scheme \(APK Signature Scheme v2\): true/.test(verified)) throw new Error('APK signature verification failed');
const entries = run(path.join(jdk, 'bin', exe('jar')), ['tf', signed]).split(/\r?\n/).filter(Boolean);
for (const required of ['classes.dex', 'resources.arsc', 'AndroidManifest.xml', 'assets/index.html', 'assets/app.js', 'assets/style.css']) if (!entries.includes(required)) throw new Error(`APK is missing ${required}`);
if (entries.some(name => name.includes('\\'))) throw new Error('APK entry names must use forward slashes');
mkdirSync(release, { recursive: true });
const output = path.join(release, `听读-${version}-Android.apk`);
cpSync(signed, output);
const digest = createHash('sha256').update(readFileSync(output)).digest('hex');
console.log(`APK ready: ${path.relative(root, output)}\n   ${statSync(output).size} bytes · SHA-256 ${digest}`);
