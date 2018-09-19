"use strict";
function main() {
    Preferencias.init();
    new Bacen();
}
Array.prototype.filterMap = function (f) {
    return this.reduce((ys, x) => f(x).fold(() => ys, y => (ys.push(y), ys)), []);
};
// Classes
/**
 * Objeto principal do programa
 */
class Bacen {
    /**
     * Função inicial do programa
     */
    constructor() {
        this.submit = false;
        this.valid = true;
        this.buscando = false;
        this.reus = [];
        this.secao = Nothing;
        this.subsecao = Nothing;
        const url = new URL(location.href);
        this.pagina = url.pathname.split('/bacenjud2/')[1].split('.')[0];
        const parametros = url.searchParams;
        const method = parametros.get('method') || '';
        if (this.pagina in this && typeof this[this.pagina] === 'function') {
            const result = this[this.pagina](method);
            result.catch(err => console.error(err));
        }
        observarPreferencia(this, 'secao');
        observarPreferencia(this, 'subsecao');
        function observarPreferencia(bacen, nome) {
            Preferencias.observar(nome, (maybe) => {
                bacen[nome] = maybe;
            });
        }
    }
    /**
     * Menu Minutas -> Incluir Minuta de Bloqueio de Valores -> Conferir dados da Minuta
     */
    async conferirDadosMinutaBVInclusao() {
        await this.tratarErros().catch(err => this.criarMinutaBVInclusao().then(() => Promise.reject(err)));
        try {
            (await obterSenhaJuiz()).focus();
        }
        catch (errSenhaJuiz) {
            const btnIncluir = await queryInputByName('btnIncluir');
            window.addEventListener('keypress', e => {
                if (e.keyCode !== 13 /* ENTER */)
                    return;
                e.preventDefault();
                e.stopPropagation();
                btnIncluir.click();
            });
        }
        function obterSenhaJuiz() {
            return queryInputByName('senhaJuiz').then(senhaJuiz => senhaJuiz.disabled
                ? Promise.reject(new Error('Campo "senhaJuiz" desabilitado.'))
                : Promise.resolve(senhaJuiz));
        }
    }
    /**
     * Menu Minutas -> Incluir Minuta de Requisição de Informações -> Conferir dados da Minuta
     */
    conferirDadosMinutaSIInclusao() {
        return this.conferirDadosMinutaBVInclusao();
    }
    /**
     * Janela pop-up aberta ao adicionar pessoa na tela de inclusão de minuta
     * de requisição de informações
     */
    consultarPessoa() {
        return this.consultarReu();
    }
    consultarSolicitacoesProtocoladas(nomeInput, tipo) {
        return Promise.all([queryInputByName(nomeInput), query('input.botao')]).then(([input, botao]) => {
            input.focus();
            input.addEventListener('change', () => tipo === 'processo'
                ? this.onConsultaProcessoChange(input)
                : this.onConsultaProtocoloChange(input));
            input.addEventListener('keypress', e => this.onProcessoKeypress(e, input));
            botao.addEventListener('click', e => this.onBotaoClick(e));
        });
    }
    /**
     * Menu Ordens judiciais -> Consultar Ordens Judiciais protocolizadas por Assessores
     */
    async consultarSolicitacoesProtocoladasAssessor() {
        return Promise.all([
            obterEFocar('dataInicial'),
            obterEFocar('cdOperadorAssessor', 'login'),
            obterEFocar('cdOperadorJuiz', 'juiz'),
        ]);
        async function obterEFocar(nomeInput, nomePreferencia) {
            const input = await queryInputByName(nomeInput);
            if (nomePreferencia === undefined) {
                input.focus();
                return;
            }
            return Preferencias.vincularInput(input, nomePreferencia, {
                focarSeVazio: true,
                salvarAoPreencher: false,
            });
        }
    }
    /**
     * Menu Ordens judiciais -> Consultar Ordens Judiciais por Juízo
     */
    async consultarSolicitacoesProtocoladasJuizo() {
        return Promise.all([vincular('codigoVara', 'vara'), vincular('operador', 'juiz')]);
        async function vincular(nomeInput, nomePreferencia) {
            return Preferencias.vincularInput(await queryInputByName(nomeInput), nomePreferencia, {
                focarSeVazio: true,
                salvarAoPreencher: false,
            });
        }
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial
     */
    consultarSolicitacoesProtocoladasProcesso() {
        return this.consultarSolicitacoesProtocoladas('numeroProcesso', 'processo');
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Protocolo Registrado no BacenJud
     */
    consultarSolicitacoesProtocoladasProtocolo() {
        return this.consultarSolicitacoesProtocoladas('numeroProtocolo', 'protocolo');
    }
    /**
     * Janela pop-up aberta ao adicionar réu
     */
    async consultarReu() {
        window.addEventListener('unload', () => Promise.resolve()
            .then(() => window.opener &&
            typeof window.opener === 'object' &&
            window.opener !== null &&
            !window.opener.closed &&
            window.opener.postMessage('processaLista', location.origin))
            .catch(err => console.error(err)));
        window.addEventListener('keypress', e => Promise.resolve()
            .then(() => {
            if (e.keyCode == 27 /* ESCAPE */) {
                window.close();
            }
        })
            .catch(err => console.error(err)));
    }
    /**
     * Menu Minutas -> Incluir Minuta de Bloqueio de Valores
     */
    async criarMinutaBVInclusao() {
        const erros = [];
        await Promise.all([queryInputByName('codigoVara'), queryInputByName('processo')])
            .then(([codigoVara, processo]) => {
            processo.addEventListener('change', () => this.onProcessoChange(processo), true);
            processo.addEventListener('keypress', e => this.onProcessoKeypress(e, processo), true);
            processo.focus();
            return Preferencias.vincularInput(codigoVara, 'vara', {
                focarSeVazio: true,
                salvarAoPreencher: false,
            });
        })
            .catch(err => {
            erros.push(err);
        });
        await queryInputByName('cdOperadorJuiz')
            .then(input => input.type === 'hidden'
            ? Promise.reject(new Error('Campo "cdOperadorJuiz" oculto.'))
            : Promise.resolve(input))
            .then(cdOperadorJuiz => {
            return Preferencias.vincularInput(cdOperadorJuiz, 'juiz', {
                focarSeVazio: true,
                salvarAoPreencher: false,
            });
        })
            .catch(errCdOperadorJuiz => {
            erros.push(errCdOperadorJuiz);
        });
        if (erros.length > 0) {
            return Promise.reject(new Error(erros.map(x => x.message).join('\n')));
        }
    }
    /**
     * Menu Minutas -> Incluir Minuta de Requisição de Informações
     */
    criarMinutaSIInclusao() {
        return this.criarMinutaBVInclusao();
    }
    dologin(_) {
        return Promise.all([
            queryInputByName('unidade'),
            queryInputByName('operador'),
            queryInputByName('senha'),
            query('#opcao_operador'),
        ]).then(([unidade, operador, senha, radio]) => vincularCampos(unidade, operador, senha, radio));
        async function vincularCampos(unidade, operador, senha, radio) {
            await Promise.all([
                Preferencias.vincularInput(unidade, 'unidade'),
                Preferencias.vincularInput(operador, 'login'),
            ]);
            window.addEventListener('load', preencher(senha, operador, unidade));
            radio.addEventListener('click', preencher(senha, operador, unidade));
        }
        function preencher(senha, operador, unidade) {
            return () => setTimeout(() => preencherCampos(senha, operador, unidade), 100);
        }
        async function preencherCampos(senha, operador, unidade) {
            // Ordem dos campos de trás para frente, pois o último campo não preenchido restará focado.
            senha.focus();
            await preencherCampo(operador, 'login');
            await preencherCampo(unidade, 'unidade');
        }
        async function preencherCampo(input, nome) {
            const pref = await Preferencias.obter(nome);
            pref.fold(() => {
                input.value = '';
                input.focus();
            }, x => {
                input.value = x;
            });
        }
    }
    /**
     * Obtém informações do processo e preenche automaticamente os campos
     */
    async getInfo(numproc, modo) {
        const estados = new Map([['70', 'PR'], ['71', 'RS'], ['72', 'SC']]);
        const estado = estados.get(this.secao.getOrElse('')) || 'SC';
        if (![10, 15, 20].includes(numproc.length)) {
            throw new Error('Número de processo inválido: ' + numproc);
        }
        const todas_partes = modo == 'preencher' ? 'S' : 'N';
        // WSDL: http://www.trf4.jus.br/trf4/processos/acompanhamento/ws_consulta_processual.php
        const response = await fetch('https://www.trf4.jus.br/trf4/processos/acompanhamento/consultaws.php', {
            method: 'POST',
            headers: new Headers({
                SOAPAction: 'consulta_processual_ws_wsdl#ws_consulta_processo',
            }),
            body: `<?xml version="1.0" encoding="UTF-8"?>
			<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
					<soapenv:Header/>
					<soapenv:Body>
							<num_proc>${numproc}</num_proc>
							<uf>${estado}</uf>
							<todas_fases>N</todas_fases>
							<todas_partes>${todas_partes}</todas_partes>
							<todos_valores>N</todos_valores>
					</soapenv:Body>
			</soapenv:Envelope>`,
        });
        if (!response.ok) {
            console.error(response);
            throw new Error('Não foi possível obter os dados do processo.');
        }
        const text = await response.text();
        this.preencher(text, modo).catch(err => console.error(err));
    }
    /**
     * Retorna o número do processo devidamente formatado
     */
    getNumproc(input) {
        const numproc = input.replace(/[^0-9\/]/g, '');
        if (/^(\d{2}|\d{4})\/\d{2,9}$/.test(numproc)) {
            const [anoDigitado, numeroDigitado] = numproc.split('/');
            let ano = Number(anoDigitado);
            if (ano < 50) {
                ano = ano + 2000;
            }
            else if (ano >= 50 && ano < 100) {
                ano = ano + 1900;
            }
            const qtdDigitosVerificadores = ano >= 2010 ? 2 : 1;
            const numero = Number(numeroDigitado.slice(0, numeroDigitado.length - qtdDigitosVerificadores));
            const ramo = '4';
            const tribunal = '04';
            return liftA2(this.secao, this.subsecao, (secao, subsecao) => {
                const r1 = Number(numero) % 97;
                const r2 = Number([r1, ano, ramo, tribunal].join('')) % 97;
                const r3 = Number([r2, secao, subsecao, '00'].join('')) % 97;
                let dv = padLeft(2, 98 - r3);
                return [padLeft(7, numero), dv, ano, ramo, tribunal, secao, subsecao].join('');
            })
                .map(valor => ({ ok: true, valor }))
                .getOrElse({ ok: false, motivo: 'erroSecaoSubsecao' });
        }
        else if (numproc.match('/')) {
            return { ok: false, motivo: 'erroDigitacaoAbreviada', valorInformado: input };
        }
        else if ([10, 15, 20].includes(numproc.length)) {
            return { ok: true, valor: numproc };
        }
        else {
            return { ok: false, motivo: 'erroDigitacao', valorInformado: input };
        }
    }
    /**
     * Retorna o número do protocolo
     */
    getProtocolo(input) {
        const protocolo = input.replace(/[^0-9\/]/g, '');
        if (/^(\d{2}|\d{4})\/\d{1,10}$/.test(protocolo)) {
            const [anoDigitado, numeroDigitado] = protocolo.split('/');
            let ano = Number(anoDigitado);
            if (ano < 50) {
                ano = ano + 2000;
            }
            else if (ano >= 50 && ano < 100) {
                ano = ano + 1900;
            }
            const numero = Number(numeroDigitado);
            return { ok: true, valor: `${(padLeft(4, ano), padLeft(10, numero))}` };
        }
        else if (protocolo.match('/')) {
            return { ok: false, motivo: 'erroDigitacaoAbreviada', valorInformado: input };
        }
        else if (protocolo.length == 14) {
            return { ok: true, valor: protocolo };
        }
        else if (protocolo.length >= 1 && protocolo.length <= 10) {
            const ano = new Date().getFullYear();
            const numero = Number(protocolo);
            return { ok: true, valor: `${padLeft(4, ano)}${padLeft(10, numero)}` };
        }
        else {
            return { ok: false, motivo: 'erroDigitacao', valorInformado: input };
        }
    }
    incluirMinuta(tipoMinuta) {
        const paginaInclusao = `criarMinuta${tipoMinuta}Inclusao.do?method=criar`;
        const selector = 'table.fundoPadraoAClaro2 > tbody > tr:first-child > td:first-child';
        return query(selector)
            .then(cell => cell.textContent || '')
            .then(txt => txt.split(/\n/))
            .then(xs => (xs.length > 2 ? Promise.resolve(xs) : Promise.reject()))
            .then(xs => xs[2])
            .then(txt => [txt, '', 'Deseja incluir nova minuta?'].join('\n'))
            .then(msg => {
            setTimeout(() => {
                if (confirm(msg)) {
                    location.href = paginaInclusao;
                }
            }, 0);
        })
            .catch(() => Promise.reject(new Error(`Elemento não encontrador: "${selector}"`)));
    }
    /**
     * Minuta conferida e incluída
     */
    incluirMinutaBV() {
        this.incluirMinuta('BV');
    }
    /**
     * Minuta conferida e incluída
     */
    incluirMinutaSI() {
        this.incluirMinuta('SI');
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial -> Botão "Consultar" -> Evento "click"
     */
    onBotaoClick(e) {
        e.preventDefault();
        e.stopPropagation();
        this.submit = true;
        if (this.submit && this.valid && !this.buscando) {
            Promise.all([
                queryInputByName('numeroProcesso').catch((err1) => queryInputByName('numeroProtocolo').catch((err2) => Promise.reject(new Error([err1, err2].map(x => x.message).join('\n'))))),
                query('form'),
            ])
                .then(([input, form]) => {
                input.select();
                input.focus();
                form.submit();
            })
                .catch(err => console.error(err));
        }
    }
    /**
     * Função que atende ao evento change do Número do Processo
     */
    onConsultaProcessoChange(input) {
        const valor = input.value;
        const numproc = this.getNumproc(valor);
        if (valor) {
            if (valor.match('/') && numproc.ok) {
                input.value = 'Carregando...';
                this.buscando = {
                    valor: valor,
                };
                this.getInfo(numproc.valor, 'consulta').catch(err => console.error(err));
                return;
            }
            if (numproc.ok) {
                input.value = numproc.valor;
                this.valid = true;
                return;
            }
            this.valid = false;
            alert('Número de processo inválido: "' + valor + '".');
            window.setTimeout(function () {
                input.value = valor;
                input.select();
                input.focus();
            }, 100);
        }
    }
    /**
     * Função que atende ao evento change do Número do Protocolo
     */
    onConsultaProtocoloChange(input) {
        const valor = input.value;
        const protocolo = this.getProtocolo(valor);
        if (valor && protocolo.ok) {
            input.value = protocolo.valor;
            this.valid = true;
        }
        else if (valor) {
            this.valid = false;
            alert('Número de protocolo inválido: "' + valor + '".');
            window.setTimeout(function () {
                input.select();
                input.focus();
            }, 100);
        }
    }
    /**
     * Função que atende ao evento change do Número do Processo
     */
    async onProcessoChange(input) {
        const valor = input.value;
        await queryInputByName('cdOperadorJuiz')
            .then(cdOperadorJuiz => {
            if (cdOperadorJuiz.type !== 'hidden') {
                cdOperadorJuiz.setAttribute('value', cdOperadorJuiz.value);
            }
        })
            .catch(() => { });
        await queryInputByName('codigoVara')
            .then(codigoVara => {
            codigoVara.setAttribute('value', codigoVara.value);
        })
            .catch(() => { });
        await query('form')
            .then(form => {
            form.reset();
        })
            .catch(() => { });
        await query('select[name="reus"]').then(select => {
            const reus = Array.from(select.options);
            if (reus.length) {
                reus.forEach(reu => (reu.selected = true));
                if (['criarMinutaBVInclusao', 'conferirDadosMinutaBVInclusao'].includes(this.pagina)) {
                    window.wrappedJSObject.excluirReu();
                }
                else if (['criarMinutaSIInclusao', 'conferirDadosMinutaSIInclusao'].includes(this.pagina)) {
                    window.wrappedJSObject.excluirPessoa();
                }
                else {
                    console.log('esta página', this.pagina);
                }
            }
        });
        if (valor) {
            input.value = 'Carregando...';
            const numproc = this.getNumproc(valor);
            if (numproc.ok) {
                this.buscando = {
                    valor: valor,
                };
                return this.getInfo(numproc.valor, 'preencher');
            }
            else {
                switch (numproc.motivo) {
                    case 'erroDigitacao':
                    case 'erroDigitacaoAbreviada':
                        alert(`Formato de número de processo desconhecido: ${numproc.valorInformado}`);
                        break;
                    case 'erroSecaoSubsecao':
                        alert('Para utilizar a digitação abreviada é preciso preencher os códigos de Seção e Subseção nas preferências da extensão.');
                        break;
                }
                setTimeout(() => {
                    input.value = valor;
                    input.select();
                    input.focus();
                }, 100);
            }
        }
    }
    /**
     * Função que atende ao evento keypress do campo Processo
     */
    onProcessoKeypress(e, input) {
        console.log('keypress', e.keyCode);
        if (![9 /* TAB */, 13 /* ENTER */].includes(e.keyCode))
            return;
        e.preventDefault();
        e.stopPropagation();
        if (input.name === 'processo') {
            query('select[name="idTipoAcao"]').then(idTipoAcao => {
                idTipoAcao.focus();
            });
        }
        else if (['numeroProcesso', 'numeroProtocolo'].includes(input.name)) {
            Promise.all([query('input.botao'), query('form')]).then(([botao, form]) => {
                this.submit = e.keyCode == 13 /* ENTER */;
                botao.focus();
                if (this.submit && this.valid && !this.buscando) {
                    input.select();
                    input.focus();
                    form.submit();
                }
            });
        }
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial -> Consultar
     *
     * @param String Método utilizado pela página
     */
    async pesquisarPorProcesso() {
        await this.tratarErros();
        return Promise.all([
            query('.pagebanner')
                .then(p => (p.textContent || '').match(/^\d+/))
                .then(x => (x === null ? Promise.reject() : Promise.resolve(x)))
                .then(xs => Number(xs[0]))
                .catch(() => Promise.reject(new Error('Elemento ".pagebanner" não possui conteúdo numérico.'))),
            query('table#ordem > tbody > tr:nth-child(1) > td:nth-child(3)').then(cell => query('a', cell)),
        ]).then(([registros, link]) => {
            if (registros === 1) {
                location.href = link.href;
            }
        });
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Protocolo Registrado no BacenJud -> Consultar
     */
    pesquisarPorProtocolo() {
        return this.tratarErros();
    }
    /**
     * Preenche os campos com as informações obtidas
     */
    async preencher(text, modo) {
        const parser = new DOMParser();
        const el = modo == 'preencher' ? 'processo' : 'numeroProcesso';
        const processo = await Promise.resolve(text)
            .then(txt => parser.parseFromString(txt, 'text/xml'))
            .then(doc => query('return', doc))
            .then(ret => ret.textContent || '')
            .then(ret => parser.parseFromString(ret, 'text/xml'));
        const campoProcesso = await queryInputByName(el);
        const erros = queryAll('Erro', processo)
            .map(erro => erro.textContent || '')
            .filter(texto => texto.trim() !== '');
        if (erros.length) {
            this.valid = false;
            const msg = erros.join('\n');
            alert(msg);
            campoProcesso.value = this.buscando.valor;
            this.buscando = false;
            campoProcesso.select();
            campoProcesso.focus();
            return Promise.reject(new Error(msg));
        }
        this.valid = true;
        this.buscando = false;
        await query('Processo Processo', processo)
            .then(p => p.textContent || '')
            .then(txt => txt.replace(/[^0-9]/g, ''))
            .then(value => {
            campoProcesso.value = value;
        });
        if (modo == 'preencher') {
            const tipoAcaoPorCodClasse = new Map([['000229', '1'], ['000098', '1'], ['000099', '4']]);
            await Promise.all([
                query('select[name="idTipoAcao"]'),
                query('CodClasse', processo).then(elt => elt.textContent || ''),
            ]).then(([tipoAcao, codClasse]) => {
                if (tipoAcaoPorCodClasse.has(codClasse)) {
                    tipoAcao.value = tipoAcaoPorCodClasse.get(codClasse);
                }
            });
            await Promise.all([
                queryInputByName('valorUnico'),
                query('ValCausa', processo)
                    .then(elt => elt.textContent || '')
                    .then(Number)
                    .then(x => isNaN(x) || x === 0
                    ? Promise.reject('Campo "ValCausa" não é um número válido.')
                    : Promise.resolve(x))
                    .then(formatNumber),
            ])
                .then(([campoValor, valor]) => {
                campoValor.value = valor;
            })
                .catch(err => console.error(err));
            const reus = [];
            function getText(p, defaultValue) {
                return p
                    .then(x => x.textContent)
                    .then(txt => (txt === null ? Promise.reject() : Promise.resolve(txt)))
                    .catch(() => defaultValue);
            }
            await Promise.all(queryAll('Partes Parte', processo).map(async (parte) => {
                if ((await getText(query('Autor', parte), 'N')) === 'S') {
                    (await queryInputByName('nomeAutor')).value = await getText(query('Nome', parte), '');
                    (await queryInputByName('cpfCnpjAutor')).value = await getText(query('CPF_CGC', parte), '');
                }
                else if ((await getText(query('Réu', parte).catch(() => query('Reu', parte)), 'N')) === 'S') {
                    reus.push(await getText(query('CPF_CGC', parte), ''));
                }
            }));
            this.processaLista(reus);
        }
        else if (modo == 'consulta') {
            if (this.submit) {
                Promise.all([queryInputByName('numeroProcesso'), query('form')]).then(([processo, form]) => {
                    processo.select();
                    processo.focus();
                    form.submit();
                });
            }
        }
    }
    /**
     * Adiciona os réus um a um
     */
    processaLista(reus) {
        if (reus !== undefined) {
            this.reus = reus;
            window.addEventListener('message', evt => {
                if (evt.origin === location.origin && evt.data === 'processaLista') {
                    this.processaLista();
                }
            });
        }
        if (this.reus.length) {
            const documento = this.reus.shift();
            Promise.all([
                query('#cpfCnpj'),
                query('#botaoIncluirCpfCnpj'),
            ]).then(([cpf, botao]) => {
                cpf.value = documento;
                botao.disabled = false;
                botao.focus();
                botao.click();
            });
        }
        else {
            query('select[name="idTipoAcao"]')
                .then(input => (input.value === '' ? Promise.resolve(input) : Promise.reject()))
                .then(input => {
                input.focus();
            })
                .catch(() => queryInputByName('valorUnico').then(input => {
                input.select();
                input.focus();
            }));
        }
    }
    async tratarErros() {
        const erros = queryAll('.msgErro')
            .map(erro => {
            erro.innerHTML = erro.innerHTML
                .replace(/\n?•(\&nbsp;)?/g, '')
                .replace('<b>', '&ldquo;')
                .replace('</b>', '&rdquo;');
            return (erro.textContent || '').trim();
        })
            .filter(x => x !== '');
        if (erros.length > 0) {
            const msg = erros.join('\n');
            alert(msg);
            throw new Error(msg);
        }
    }
}
class Validation {
    constructor(fold) {
        this.fold = fold;
    }
    altL(lazy) {
        return this.fold(theseErrors => lazy().fold(thoseErrors => Failure(theseErrors.concat(thoseErrors)), Success), Success);
    }
    ap(that) {
        return this.fold(theseErrors => Failure(that.fold(thoseErrors => theseErrors.concat(thoseErrors), () => theseErrors)), x => that.fold(Failure, f => Success(f(x))));
    }
    chain(f) {
        return this.fold(Failure, f);
    }
    map(f) {
        return this.fold(Failure, x => Success(f(x)));
    }
    static fail(error) {
        return Failure([error]);
    }
    static of(value) {
        return Success(value);
    }
}
function Failure(errors) {
    return new Validation((F, _) => F(errors));
}
function Success(value) {
    return new Validation((_, S) => S(value));
}
class Maybe {
    constructor(fold) {
        this.fold = fold;
    }
    alt(that) {
        return this.fold(() => that, Maybe.of);
    }
    altL(lazy) {
        return this.fold(lazy, () => this);
    }
    ap(that) {
        return that.chain(f => this.map(f));
    }
    chain(f) {
        return this.fold(() => Nothing, f);
    }
    concat(that) {
        return this.fold(() => that, xs => that.map(ys => xs.concat(ys)));
    }
    filter(p) {
        return this.fold(() => Nothing, x => (p(x) ? Just(x) : Nothing));
    }
    map(f) {
        return this.chain(x => Just(f(x)));
    }
    mapNullable(f) {
        return this.chain(x => Maybe.fromNullable(f(x)));
    }
    getOrElse(defaultValue) {
        return this.fold(() => defaultValue, x => x);
    }
    getOrElseL(lazy) {
        return this.fold(lazy, x => x);
    }
    static fromNullable(value) {
        return value == null ? Nothing : Just(value);
    }
    static of(value) {
        return new Maybe((_, J) => J(value));
    }
    static zero() {
        return new Maybe((N, _) => N());
    }
}
function Just(value) {
    return Maybe.of(value);
}
const Nothing = Maybe.zero();
class Preferencias {
    static init() {
        if (this.initialized)
            return;
        browser.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local')
                return;
            const changed = Object.keys(changes);
            changed.forEach(key => {
                const value = changes[key].newValue;
                if (this.inputs.has(key)) {
                    this.inputs.get(key).forEach(input => {
                        if (input.value.trim() === '') {
                            input.value = value || '';
                        }
                    });
                }
                const maybeValue = Maybe.fromNullable(value);
                if (this.callbacks.has(key)) {
                    this.callbacks.get(key).forEach(callback => {
                        callback(maybeValue);
                    });
                }
            });
        });
        this.initialized = true;
    }
    static observar(nome, callback) {
        this.callbacks.set(nome, (this.callbacks.get(nome) || []).concat(callback));
        return this.obter(nome).then(callback);
    }
    static obter(nome, valorPadrao) {
        const maybeValorPadrao = Maybe.fromNullable(valorPadrao);
        return browser.storage.local
            .get(nome)
            .then(prefs => Maybe.fromNullable(prefs[nome]))
            .then(maybe => maybeValorPadrao.fold(() => maybe, valor => maybe.getOrElse(valor)));
    }
    static async vincularInput(input, nome, opcoes = {
        focarSeVazio: false,
        salvarAoPreencher: true,
    }) {
        if (opcoes.salvarAoPreencher) {
            input.addEventListener('change', () => {
                const valor = input.value.trim();
                const promise = valor !== ''
                    ? browser.storage.local.set({ [nome]: valor })
                    : browser.storage.local.remove(nome);
                promise.catch(err => console.error(err));
            });
        }
        this.inputs.set(nome, (this.inputs.get(nome) || []).concat([input]));
        const valor = await this.obter(nome);
        valor.fold(() => {
            input.value = '';
            if (opcoes.focarSeVazio)
                input.focus();
        }, x => {
            input.value = x;
        });
    }
}
Preferencias.initialized = false;
Preferencias.inputs = new Map();
Preferencias.callbacks = new Map();
class QueryError extends Error {
    constructor(msg, data) {
        super(msg);
        this.data = data;
    }
}
// Funções
function assertStrictEquals(expected, actual) {
    if (actual !== expected) {
        return Validation.fail(`"${actual}" !== "${expected}".`);
    }
    return Validation.of(actual);
}
function formatNumber(num) {
    return num.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        minimumIntegerDigits: 1,
        useGrouping: true,
    });
}
function liftA(ax, f) {
    return ax.map(f);
}
function liftA2(ax, ay, f) {
    return ay.ap(ax.map((x) => (y) => f(x, y)));
}
function liftA3(ax, ay, az, f) {
    return az.ap(ay.ap(ax.map((x) => (y) => (z) => f(x, y, z))));
}
function liftA4(aw, ax, ay, az, f) {
    return az.ap(ay.ap(ax.ap(aw.map((w) => (x) => (y) => (z) => f(w, x, y, z)))));
}
function padLeft(size, number) {
    let result = String(number);
    while (result.length < size) {
        result = `0${result}`;
    }
    return result;
}
function query(selector, context = document) {
    return new Promise((res, rej) => {
        const elt = context.querySelector(selector);
        if (!elt) {
            return rej(new QueryError(`Elemento não encontrado: '${selector}'.`, { context, selector }));
        }
        return res(elt);
    });
}
function queryAll(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
}
function queryMaybe(selector, context = document) {
    const elt = context.querySelector(selector);
    return elt === null ? [] : [elt];
}
function queryInputByName(name, context = document) {
    return new Promise((res, rej) => {
        const elt = context.querySelector(`input[name="${name}"]`);
        if (!elt) {
            return rej(new QueryError(`Campo não encontrado: "${name}".`, { context, name }));
        }
        return res(elt);
    });
}
main();
