"use strict";
function main() {
    Preferencias.init();
    new Bacen();
}
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
            if (result instanceof Promise) {
                result.catch(err => console.error(err));
            }
        }
        const observarPreferencia = (nome) => {
            Preferencias.observar(nome, (maybe) => {
                this[nome] = maybe;
            });
        };
        observarPreferencia('secao');
        observarPreferencia('subsecao');
    }
    /**
     * Menu Minutas -> Incluir Minuta de Bloqueio de Valores -> Conferir dados da Minuta
     */
    conferirDadosMinutaBVInclusao(method) {
        assertStrictEquals('conferirDados', method);
        if (this.tratarErros())
            return;
        liftA1(queryInputByName('senhaJuiz').filter(senhaJuiz => !senhaJuiz.disabled), senhaJuiz => {
            senhaJuiz.focus();
        }).altL(() => liftA1(query('[name="btnIncluir"]'), btnIncluir => {
            window.addEventListener('keypress', e => {
                if (e.keyCode == 13) {
                    e.preventDefault();
                    e.stopPropagation();
                    btnIncluir.click();
                }
            }, true);
        }));
    }
    /**
     * Menu Minutas -> Incluir Minuta de Requisição de Informações -> Conferir dados da Minuta
     */
    conferirDadosMinutaSIInclusao(method) {
        this.conferirDadosMinutaBVInclusao(method);
    }
    /**
     * Janela pop-up aberta ao adicionar pessoa na tela de inclusão de minuta
     * de requisição de informações
     */
    consultarPessoa(method) {
        this.consultarReu(method);
    }
    consultarSolicitacoesProtocoladas(nomeInput, nomeMetodoOnChange) {
        liftA2(queryInputByName(nomeInput), query('.botao'), (input, botao) => {
            input.focus();
            input.addEventListener('change', () => this[nomeMetodoOnChange](input), true);
            input.addEventListener('keypress', e => this.onProcessoKeypress(e, input), true);
            botao.addEventListener('click', e => this.onBotaoClick(e), true);
        });
    }
    /**
     * Menu Ordens judiciais -> Consultar Ordens Judiciais protocolizadas por Assessores
     */
    consultarSolicitacoesProtocoladasAssessor(method) {
        assertStrictEquals('editarCriteriosConsultaPorAssessor', method);
        queryInputByName('dataInicial').map(input => {
            input.focus();
        });
        vincular('cdOperadorAssessor', 'login');
        vincular('cdOperadorJuiz', 'juiz');
        function vincular(nomeInput, nomePreferencia) {
            liftA1(queryInputByName(nomeInput), input => {
                Preferencias.vincularInput(input, nomePreferencia, {
                    focarSeVazio: true,
                    salvarAoPreencher: false,
                });
            });
        }
    }
    /**
     * Menu Ordens judiciais -> Consultar Ordens Judiciais por Juízo
     */
    consultarSolicitacoesProtocoladasJuizo(method) {
        assertStrictEquals('editarCriteriosConsultaPorVara', method);
        vincular('codigoVara', 'vara');
        vincular('operador', 'juiz');
        function vincular(nomeInput, nomePreferencia) {
            liftA1(queryInputByName(nomeInput), input => {
                Preferencias.vincularInput(input, nomePreferencia, {
                    focarSeVazio: true,
                    salvarAoPreencher: false,
                });
            });
        }
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial
     */
    consultarSolicitacoesProtocoladasProcesso(method) {
        assertStrictEquals('editarCriteriosConsultaPorProcesso', method);
        this.consultarSolicitacoesProtocoladas('numeroProcesso', 'onConsultaProcessoChange');
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Protocolo Registrado no BacenJud
     */
    consultarSolicitacoesProtocoladasProtocolo(method) {
        assertStrictEquals('editarCriteriosConsultaPorProtocolo', method);
        this.consultarSolicitacoesProtocoladas('numeroProtocolo', 'onConsultaProtocoloChange');
    }
    /**
     * Janela pop-up aberta ao adicionar réu
     */
    consultarReu(method) {
        assertStrictEquals('consultarReu', method);
        window.addEventListener('unload', () => {
            window.opener.setTimeout('processaLista();', 100);
        }, true);
        window.addEventListener('keypress', e => {
            if (e.keyCode == 27) {
                window.close();
            }
        }, true);
    }
    /**
     * Menu Minutas -> Incluir Minuta de Bloqueio de Valores
     */
    async criarMinutaBVInclusao(method) {
        assertStrictEquals('criar', method);
        await liftA2(queryInputByName('codigoVara'), queryInputByName('processo'), (codigoVara, processo) => {
            processo.addEventListener('change', () => this.onProcessoChange(processo), true);
            processo.addEventListener('keypress', e => this.onProcessoKeypress(e, processo), true);
            processo.focus();
            return Preferencias.vincularInput(codigoVara, 'vara', {
                focarSeVazio: true,
                salvarAoPreencher: false,
            });
        }).getOrElseL(() => Promise.reject(new Error(`Elementos necessários não encontrados: codigoVara, processo.`)));
        return liftA1(queryInputByName('cdOperadorJuiz').filter(input => input.type !== 'hidden'), cdOperadorJuiz => {
            return Preferencias.vincularInput(cdOperadorJuiz, 'juiz', {
                focarSeVazio: true,
                salvarAoPreencher: false,
            });
        }).getOrElse(Promise.resolve());
    }
    /**
     * Menu Minutas -> Incluir Minuta de Requisição de Informações
     */
    criarMinutaSIInclusao(method) {
        this.criarMinutaBVInclusao(method);
    }
    async dologin(_) {
        return liftA4(queryInputByName('unidade'), queryInputByName('operador'), queryInputByName('senha'), query('#opcao_operador'), vincularCampos);
        function vincularCampos(unidade, operador, senha, radio) {
            Preferencias.vincularInput(unidade, 'unidade');
            Preferencias.vincularInput(operador, 'login');
            window.addEventListener('load', preencher(senha, operador, unidade));
            radio.addEventListener('click', preencher(senha, operador, unidade));
        }
        function preencher(senha, operador, unidade) {
            return () => setTimeout(() => {
                preencherCampos(senha, operador, unidade).catch(err => console.error(err));
            }, 100);
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
        const response = await fetch('http://www.trf4.jus.br/trf4/processos/acompanhamento/consultaws.php', {
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
        this.preencher(text, modo);
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
    incluirMinuta(tipoMinuta, method) {
        assertStrictEquals('incluir', method);
        const paginaInclusao = `criarMinuta${tipoMinuta}Inclusao.do?method=criar`;
        liftA1(query('fundoPadraoAClaro2')
            .mapNullable(tbl => tbl.rows[0])
            .mapNullable(row => row.cells[0])
            .mapNullable(cell => cell.textContent)
            .map(txt => txt.split(/\n/))
            .filter(xs => xs.length > 2)
            .map(xs => xs[2])
            .map(txt => [txt, '', 'Deseja incluir nova minuta?'].join('\n')), msg => {
            window.setTimeout(() => {
                if (window.confirm(msg)) {
                    location.href = paginaInclusao;
                }
            }, 0);
        });
    }
    /**
     * Minuta conferida e incluída
     */
    incluirMinutaBV(method) {
        this.incluirMinuta('BV', method);
    }
    /**
     * Minuta conferida e incluída
     */
    incluirMinutaSI(method) {
        this.incluirMinuta('SI', method);
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial -> Botão "Consultar" -> Evento "click"
     */
    onBotaoClick(e) {
        e.preventDefault();
        e.stopPropagation();
        this.submit = true;
        if (this.submit && this.valid && !this.buscando) {
            liftA2(queryInputByName('numeroProcesso').alt(queryInputByName('numeroProtocolo')), query('form'), (input, form) => {
                input.select();
                input.focus();
                form.submit();
            });
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
                this.getInfo(numproc.valor, 'consulta');
            }
            else if (numproc.ok) {
                input.value = numproc.valor;
                this.valid = true;
            }
            else {
                this.valid = false;
                alert('Número de processo inválido: "' + valor + '".');
                window.setTimeout(function () {
                    input.value = valor;
                    input.select();
                    input.focus();
                }, 100);
            }
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
    onProcessoChange(input) {
        const valor = input.value;
        liftA1(query('form'), form => {
            form.reset();
        });
        liftA1(query('[name="reus"]').chain(reus => Array.from(reus.options)
            .map(reu => ((reu.selected = true), reu))
            .reduce((acc, x) => acc.concat(Just([x])), Nothing)), () => {
            if (this.pagina === 'criarMinutaBVInclusao') {
                window.wrappedJSObject.excluirReu();
            }
            else if (this.pagina === 'criarMinutaSIInclusao') {
                window.wrappedJSObject.excluirPessoa();
            }
        });
        if (valor) {
            input.value = 'Carregando...';
            const numproc = this.getNumproc(valor);
            if (numproc.ok) {
                this.buscando = {
                    valor: valor,
                };
                this.getInfo(numproc.valor, 'preencher');
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
        if (![9 /* TAB */, 13 /* ENTER */].includes(e.keyCode))
            return;
        e.preventDefault();
        e.stopPropagation();
        if (input.name === 'processo') {
            liftA1(queryInputByName('idTipoAcao'), idTipoAcao => {
                idTipoAcao.focus();
            });
        }
        else if (['numeroProcesso', 'numeroProtocolo'].includes(input.name)) {
            liftA2(query('input.botao'), query('form'), (botao, form) => {
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
    pesquisarPorProcesso(method) {
        assertStrictEquals('pesquisarPorProcesso', method);
        if (this.tratarErros())
            return;
        liftA2(query('.pagebanner')
            .mapNullable(p => p.textContent)
            .mapNullable(txt => txt.match(/^\d+/))
            .map(xs => xs[0])
            .map(Number), query('table#ordem')
            .mapNullable(tbl => tbl.rows[1])
            .mapNullable(row => row.cells[3])
            .chain(cell => query('a', cell)), (registros, link) => {
            if (registros === 1) {
                location.href = link.href;
            }
        });
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Protocolo Registrado no BacenJud -> Consultar
     */
    pesquisarPorProtocolo(method) {
        assertStrictEquals('pesquisarPorProtocolo', method);
        if (this.tratarErros())
            return;
    }
    /**
     * Preenche os campos com as informações obtidas
     */
    preencher(text, modo) {
        const parser = new DOMParser();
        const el = modo == 'preencher' ? 'processo' : 'numeroProcesso';
        liftA2(Just(text)
            .map(txt => parser.parseFromString(txt, 'text/xml'))
            .chain(doc => query('return', doc))
            .mapNullable(ret => ret.textContent)
            .map(ret => parser.parseFromString(ret, 'text/xml')), queryInputByName(el), (processo, campoProcesso) => {
            const erros = queryAll('Erro', processo)
                .map(erro => erro.textContent || '')
                .filter(texto => texto.trim() !== '');
            if (erros.length) {
                this.valid = false;
                alert(erros.join('\n'));
                campoProcesso.value = this.buscando.valor;
                this.buscando = false;
                campoProcesso.select();
                campoProcesso.focus();
                return;
            }
            this.valid = true;
            this.buscando = false;
            liftA1(query('Processo Processo', processo)
                .mapNullable(p => p.textContent)
                .map(txt => txt.replace(/[^0-9]/g, '')), value => {
                campoProcesso.value = value;
            });
            if (modo == 'preencher') {
                const tipoAcaoPorCodClasse = new Map([['000229', '1'], ['000098', '1'], ['000099', '4']]);
                liftA2(queryInputByName('idTipoAcao'), query('CodClasse', processo).mapNullable(elt => elt.textContent), (tipoAcao, codClasse) => {
                    if (tipoAcaoPorCodClasse.has(codClasse)) {
                        tipoAcao.value = tipoAcaoPorCodClasse.get(codClasse);
                    }
                });
                liftA2(queryInputByName('valorUnico'), query('ValCausa', processo)
                    .mapNullable(elt => elt.textContent)
                    .map(Number)
                    .filter(x => !isNaN(x))
                    .map(formatNumber), (campoValor, valor) => {
                    campoValor.value = valor;
                });
                const reus = [];
                function getText(maybe, defaultValue) {
                    const result = maybe.mapNullable(node => node.textContent);
                    return defaultValue === undefined ? result : result.getOrElse(defaultValue);
                }
                queryAll('Partes Parte', processo).forEach(parte => {
                    const maybeNomeAutor = queryInputByName('nomeAutor');
                    const maybeCpfCnpjAutor = queryInputByName('cpfCnpjAutor');
                    if (getText(query('Autor', parte), 'N') === 'S') {
                        liftA2(maybeNomeAutor, maybeCpfCnpjAutor, (nomeAutor, cpfCnpjAutor) => {
                            nomeAutor.value = getText(query('Nome', parte), '');
                            cpfCnpjAutor.value = getText(query('CPF_CGC', parte), '');
                        });
                    }
                    else if (getText(query('Réu', parte).alt(query('Reu', parte)), 'N') === 'S') {
                        liftA1(getText(query('CPF_CGC', parte)), cpfCnpjReu => {
                            reus.push(cpfCnpjReu);
                        });
                    }
                });
                this.processaLista(reus);
            }
            else if (modo == 'consulta') {
                if (this.submit) {
                    liftA2(queryInputByName('numeroProcesso'), query('form'), (processo, form) => {
                        processo.select();
                        processo.focus();
                        form.submit();
                    });
                }
            }
        });
    }
    /**
     * Adiciona os réus um a um
     */
    processaLista(reus) {
        if (reus !== undefined) {
            this.reus = reus;
            const self = this;
            window.wrappedJSObject.processaLista = function () {
                self.processaLista.apply(self, []);
            };
        }
        if (this.reus.length) {
            const documento = this.reus.shift();
            liftA2(query('#cpfCnpj'), query('#botaoIncluirCpfCnpj'), (cpf, botao) => {
                cpf.value = documento;
                botao.disabled = false;
                botao.focus();
                botao.click();
            });
        }
        else {
            liftA1(queryInputByName('idTipoAcao').filter(input => input.value === ''), input => {
                input.focus();
            }).altL(() => liftA1(queryInputByName('valorUnico'), input => {
                input.select();
                input.focus();
            }));
        }
    }
    tratarErros() {
        const erros = queryAll('.msgErro').map(erro => {
            erro.innerHTML = erro.innerHTML
                .replace(/\n?•(\&nbsp;)?/g, '')
                .replace('<b>', '&ldquo;')
                .replace('</b>', '&rdquo;');
            return erro.textContent;
        });
        if (erros.length) {
            const msgErro = erros.join('\n');
            alert(msgErro);
            history.go(-1);
            return true;
        }
        return false;
    }
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
// Funções
function assertStrictEquals(expected, actual) {
    if (actual !== expected) {
        throw new Error(`"${actual}" !== "${expected}".`);
    }
}
function formatNumber(num) {
    return num.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        minimumIntegerDigits: 1,
        useGrouping: true,
    });
}
function liftA1(ax, f) {
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
    return Maybe.fromNullable(context.querySelector(selector));
}
function queryAll(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
}
function queryInputByName(name, context = document) {
    return Maybe.fromNullable(context.querySelector(`input[name="${name}"]`));
}
main();
