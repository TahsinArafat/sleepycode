{
  lib,
  stdenvNoCC,
  callPackage,
  bun,
  nodejs,
  sysctl,
  makeBinaryWrapper,
  models-dev,
  ripgrep,
  wayland,
  installShellFiles,
  versionCheckHook,
  writableTmpDirAsHomeHook,
  node_modules ? callPackage ./node_modules.nix { },
}:
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "sleepycode";
  inherit (node_modules) version src;
  inherit node_modules;

  nativeBuildInputs = [
    bun
    nodejs # for patchShebangs node_modules
    installShellFiles
    makeBinaryWrapper
    models-dev
    writableTmpDirAsHomeHook
  ];

  postPatch = ''
    # NOTE: Relax Bun version check to be a warning instead of an error
    substituteInPlace packages/script/src/index.ts \
      --replace-fail 'throw new Error(`This script requires bun@''${expectedBunVersionRange}' \
                     'console.warn(`Warning: This script requires bun@''${expectedBunVersionRange}'
  '';

  configurePhase = ''
    runHook preConfigure

    cp -R ${finalAttrs.node_modules}/. .
    patchShebangs node_modules
    patchShebangs packages/*/node_modules

    runHook postConfigure
  '';

  env.MODELS_DEV_API_JSON = "${models-dev}/dist/_api.json";
  env.SLEEPYCODE_DISABLE_MODELS_FETCH = true;
  env.SLEEPYCODE_VERSION = finalAttrs.version;
  env.SLEEPYCODE_CHANNEL = "prod";
  env.NODE_OPTIONS = "--max-old-space-size=4096";

  buildPhase = ''
    runHook preBuild

    cd ./packages/cli
    bun --bun ./script/build.ts --single --skip-install

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    install -Dm755 dist/cli-*/bin/sleepycode $out/bin/sleepycode

    # OpenTUI dlopens Wayland for clipboard images.
    wrapProgram $out/bin/sleepycode \
      --prefix PATH : ${
        lib.makeBinPath (
          [
            ripgrep
          ]
          # bun runs sysctl to detect if running on rosetta2
          ++ lib.optional stdenvNoCC.hostPlatform.isDarwin sysctl
        )
      } ${lib.optionalString stdenvNoCC.hostPlatform.isLinux ''
        --prefix LD_LIBRARY_PATH : ${lib.makeLibraryPath [ wayland ]}
      ''}

    ln -s sleepycode $out/bin/sleepycode2

    runHook postInstall
  '';

  postInstall = lib.optionalString (stdenvNoCC.buildPlatform.canExecute stdenvNoCC.hostPlatform) ''
    # v2 dropped the `completion` subcommand; --completions is the global flag.
    # --completions also accepts sh, which emits the same script as bash.
    # staged to files, substitute below rejects anything that is not a regular file
    $out/bin/sleepycode --completions bash > sleepycode.bash
    $out/bin/sleepycode --completions zsh > _sleepycode
    $out/bin/sleepycode --completions fish > sleepycode.fish

    installShellCompletion --cmd sleepycode \
      --bash sleepycode.bash \
      --fish sleepycode.fish \
      --zsh _sleepycode

    # SLEEPYCODE_CLI_NAME is a build-time define, so the sleepycode2 copies are
    # renamed rather than regenerated. --replace-fail is a global literal
    # substitution, so any lowercase sleepycode that later appears in a
    # description or help text ships as sleepycode2 in the sleepycode2 copy.
    substitute sleepycode.bash sleepycode2.bash --replace-fail sleepycode sleepycode2
    substitute _sleepycode _sleepycode2 --replace-fail sleepycode sleepycode2
    substitute sleepycode.fish sleepycode2.fish --replace-fail sleepycode sleepycode2

    installShellCompletion --cmd sleepycode2 \
      --bash sleepycode2.bash \
      --fish sleepycode2.fish \
      --zsh _sleepycode2
  '';

  nativeInstallCheckInputs = [
    versionCheckHook
    writableTmpDirAsHomeHook
  ];
  doInstallCheck = true;
  versionCheckKeepEnvironment = [ "HOME" "SLEEPYCODE_DISABLE_MODELS_FETCH" ];
  versionCheckProgramArg = "--version";

  passthru = {
    env = finalAttrs.env;
  };

  meta = {
    description = "The open source coding agent";
    homepage = "https://opencode.ai";
    license = lib.licenses.mit;
    mainProgram = "sleepycode";
    inherit (node_modules.meta) platforms;
  };
})
