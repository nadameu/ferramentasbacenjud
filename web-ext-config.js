module.exports = {
	ignoreFiles: ['package-lock.json', 'package.json', 'tsconfig.json', 'web-ext-config.js', '*.ts'],
	lint: { selfHosted: true },
	run: { startUrl: ['https://www3.bcb.gov.br/bacenjud2/'] },
};
