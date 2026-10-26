module.exports = {
  appId:'br.com.kayanlucas.financeiro',
  productName:'Financeiro',
  executableName:'Financeiro',
  directories:{output:'dist-installer',buildResources:'assets/icons'},
  asar:true,
  electronDist:'node_modules/electron/dist',
  npmRebuild:false, // SQLite is built into Electron; there is no native addon to rebuild.
  files:[
    'package.json','db.js','server.js','desktop/**/*.cjs',
    'services/**/*','repositories/**/*','controllers/**/*','routes/**/*','middlewares/**/*','validators/**/*',
    'database/sqlite/**/*.cjs','database/sqlite/migrations/*.sql',
    'frontend/dist/**/*','assets/icons/financeiro.ico',
    '!**/.env','!**/.env.*','!**/*.sqlite','!**/*.sqlite-*','!**/*.db','!**/*.log','!**/backups/**',
    '!**/tests/**','!database/postgres/**','!frontend/node_modules/**'
  ],
  win:{target:[{target:'nsis',arch:['x64']}],icon:'assets/icons/financeiro.ico',
    // Resource editing remains enabled for the icon. No certificate is required.
    signAndEditExecutable:true,signExecutable:process.env.FINANCEIRO_SIGNING==='1'},
  nsis:{
    oneClick:false,perMachine:false,allowElevation:false,allowToChangeInstallationDirectory:true,
    createDesktopShortcut:true,createStartMenuShortcut:true,shortcutName:'Financeiro',
    uninstallDisplayName:'Financeiro',deleteAppDataOnUninstall:false,runAfterFinish:false,
    installerIcon:'assets/icons/financeiro.ico',uninstallerIcon:'assets/icons/financeiro.ico',
    artifactName:'Financeiro-Setup-${version}.${ext}'
  },
  publish:null
};
