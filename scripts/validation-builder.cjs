const path=require('node:path');
const id=process.env.FINANCEIRO_VALIDATION_ID;
const version=process.env.FINANCEIRO_VALIDATION_VERSION;
if(!/^[a-f0-9-]{36}$/.test(id||'') || !['0.9.9','1.0.0'].includes(version)) throw new Error('Validation-only build requires an isolated identity and explicit test version');
const base=require('../electron-builder.cjs');
const name='Financeiro Validacao '+id.slice(0,8);
module.exports={...base,appId:'br.com.kayanlucas.financeiro.validation.'+id,
  productName:name,extraMetadata:{version},
  directories:{...base.directories,output:path.resolve(__dirname,'../dist-installer/validation-'+id,version)},
  nsis:{...base.nsis,shortcutName:name,uninstallDisplayName:name,artifactName:'Financeiro-Validation-${version}.${ext}'},
  win:{...base.win,signExecutable:false}
};
