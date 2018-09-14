"use strict";
function main() {
    Preferencias.init();
    new Bacen();
}
/**
 * Objeto principal do programa
 */
class Bacen {
    /**
     * Função inicial do programa
     */
    constructor() {
        this.submit = false;
        this.valid = false;
        this.buscando = false;
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
    }
    /**
     * Menu Minutas -> Incluir Minuta de Bloqueio de Valores -> Conferir dados da Minuta
     */
    conferirDadosMinutaBVInclusao(method) {
        if (method == 'conferirDados') {
            let erros;
            let msgErro = '';
            const senhaJuiz = query('[name="senhaJuiz"]');
            const btnIncluir = query('[name="btnIncluir"]');
            if ((erros = document.getElementsByClassName('msgErro')).length) {
                Array.from(erros).forEach(function (erro) {
                    erro.innerHTML = erro.innerHTML
                        .replace(/\n?•(\&nbsp;)?/g, '')
                        .replace('<b>', '&ldquo;')
                        .replace('</b>', '&rdquo;');
                    msgErro += erro.textContent + '\n';
                });
                window.alert(msgErro);
                window.history.go(-1);
            }
            else if (senhaJuiz && !senhaJuiz.disabled) {
                senhaJuiz.focus();
            }
            else if (btnIncluir) {
                window.addEventListener('keypress', function (e) {
                    if (e.keyCode == 13) {
                        e.preventDefault();
                        e.stopPropagation();
                        const evento = document.createEvent('MouseEvents');
                        evento.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
                        btnIncluir.dispatchEvent(evento);
                    }
                }, true);
            }
        }
        else {
            throw new Error('Método desconhecido: ' + method);
        }
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
    /**
     * Menu Ordens judiciais -> Consultar Ordens Judiciais por Juízo
     */
    consultarSolicitacoesProtocoladasJuizo(method) {
        if (method == 'editarCriteriosConsultaPorVara') {
            const codigoVara = query('[name="codigoVara"]');
            if (codigoVara) {
                codigoVara.value = GM_getValue('vara');
            }
            const operador = query('[name="operador"]');
            if (operador) {
                operador.value = GM_getValue('juiz');
            }
        }
        else {
            throw new Error('Método desconhecido: ' + method);
        }
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial
     */
    consultarSolicitacoesProtocoladasProcesso(method) {
        if (method == 'editarCriteriosConsultaPorProcesso') {
            const numeroProcesso = query('[name="numeroProcesso"]');
            if (numeroProcesso) {
                numeroProcesso.focus();
                numeroProcesso.addEventListener('change', () => this.onConsultaProcessoChange(numeroProcesso), true);
                numeroProcesso.addEventListener('keypress', e => this.onProcessoKeypress(e, numeroProcesso), true);
                document
                    .getElementsByClassName('botao')[0]
                    .addEventListener('click', e => this.onBotaoClick(e), true);
            }
        }
        else {
            throw new Error('Método desconhecido: ' + method);
        }
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Protocolo Registrado no BacenJud
     */
    consultarSolicitacoesProtocoladasProtocolo(method) {
        if (method == 'editarCriteriosConsultaPorProtocolo') {
            const numeroProtocolo = query('[name="numeroProtocolo"]');
            if (numeroProtocolo) {
                numeroProtocolo.focus();
                numeroProtocolo.addEventListener('change', () => this.onConsultaProtocoloChange(numeroProtocolo), true);
                numeroProtocolo.addEventListener('keypress', e => this.onProcessoKeypress(e, numeroProtocolo), true);
                document
                    .getElementsByClassName('botao')[0]
                    .addEventListener('click', e => this.onBotaoClick(e), true);
            }
        }
        else {
            throw new Error('Método desconhecido: ' + method);
        }
    }
    /**
     * Janela pop-up aberta ao adicionar réu
     */
    consultarReu(method) {
        if (method == 'consultarReu') {
            window.addEventListener('unload', () => {
                window.opener.setTimeout('processaLista();', 100);
            }, true);
            window.addEventListener('keypress', e => {
                if (e.keyCode == 27) {
                    window.close();
                }
            }, true);
        }
        else {
            throw new Error('Método desconhecido: ' + method);
        }
    }
    /**
     * Menu Minutas -> Incluir Minuta de Bloqueio de Valores
     */
    criarMinutaBVInclusao(method) {
        if (method == 'criar') {
            const cdOperadorJuiz = query('[name="cdOperadorJuiz"]');
            const codigoVara = query('[name="codigoVara"]');
            const processo = query('[name="processo"]');
            if (cdOperadorJuiz && cdOperadorJuiz.type != 'hidden') {
                cdOperadorJuiz.setAttribute('value', GM_getValue('juiz'));
            }
            if (codigoVara && processo) {
                codigoVara.setAttribute('value', GM_getValue('vara'));
                processo.select();
                processo.focus();
                processo.addEventListener('change', () => this.onProcessoChange(processo), true);
                processo.addEventListener('keypress', e => this.onProcessoKeypress(e, processo), true);
            }
        }
        else {
            throw new Error('Método desconhecido: ' + method);
        }
    }
    /**
     * Menu Minutas -> Incluir Minuta de Requisição de Informações
     */
    criarMinutaSIInclusao(method) {
        this.criarMinutaBVInclusao(method);
    }
    async dologin(_) {
        return liftA4(query('[name="unidade"]'), query('[name="operador"]'), query('[name="senha"]'), query('#opcao_operador'), vincularCampos);
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
    getInfo(numproc, modo) {
        const estados = new Map([['70', 'PR'], ['71', 'RS'], ['72', 'SC']]);
        const estado = estados.get(GM_getValue('secao')) || 'SC';
        if (![10, 15, 20].includes(numproc.length)) {
            throw new Error('Número de processo inválido: ' + numproc);
        }
        const todas_partes = modo == 'preencher' ? 'S' : 'N';
        // WSDL: http://www.trf4.jus.br/trf4/processos/acompanhamento/ws_consulta_processual.php
        const self = this;
        const options = {
            method: 'POST',
            url: 'http://www.trf4.jus.br/trf4/processos/acompanhamento/consultaws.php',
            data: `<?xml version="1.0" encoding="UTF-8"?>
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
            onload: function () {
                return self.preencher(this, modo);
            },
            headers: {
                SOAPAction: 'consulta_processual_ws_wsdl#ws_consulta_processo',
            },
        };
        GM_xmlhttpRequest(options);
    }
    /**
     * Retorna o número do processo devidamente formatado
     */
    getNumproc(input) {
        const secao = GM_getValue('secao');
        const subsecao = GM_getValue('subsecao');
        const ramo = '4';
        const tribunal = '04';
        let ano;
        let numero;
        const numproc = input.replace(/[^0-9\/]/g, '');
        if (/^(\d{2}|\d{4})\/\d{2,9}$/.test(numproc)) {
            const tmp = numproc.split('/');
            ano = Number(tmp[0]);
            if (ano < 50) {
                ano = Number(ano) + 2000;
            }
            else if (ano >= 50 && ano < 100) {
                ano = Number(ano) + 1900;
            }
            if (ano >= 2010) {
                numero = tmp[1].substr(0, tmp[1].length - 2);
            }
            else {
                numero = tmp[1].substr(0, tmp[1].length - 1);
            }
        }
        else if (numproc.match('/')) {
            return false;
        }
        else if ([10, 15, 20].includes(numproc.length)) {
            return numproc;
        }
        else {
            return false;
        }
        while (numero.length < 7) {
            numero = '0' + numero;
        }
        const r1 = Number(numero) % 97;
        const r2 = Number('' + r1 + ano + ramo + tribunal) % 97;
        const r3 = Number('' + r2 + secao + subsecao + '00') % 97;
        let dv = String(98 - r3);
        while (dv.length < 2)
            dv = '0' + dv;
        return [numero, dv, ano, ramo, tribunal, secao, subsecao].map(String).join('');
    }
    /**
     * Retorna o número do protocolo
     */
    getProtocolo(input) {
        let protocolo = input.replace(/[^0-9\/]/g, '');
        let ano;
        let numero;
        if (/^(\d{2}|\d{4})\/\d{1,10}$/.test(protocolo)) {
            const tmp = protocolo.split('/');
            ano = Number(tmp[0]);
            if (ano < 50) {
                ano = Number(ano) + 2000;
            }
            else if (ano >= 50 && ano < 100) {
                ano = Number(ano) + 1900;
            }
            numero = Number(tmp[1]);
        }
        else if (protocolo.match('/')) {
            return false;
        }
        else if (protocolo.length == 14) {
            return protocolo;
        }
        else if (protocolo.length >= 1 && protocolo.length <= 10) {
            ano = new Date().getFullYear();
            numero = Number(protocolo);
        }
        else {
            return false;
        }
        while (protocolo.length < 10)
            protocolo = '0' + protocolo;
        return `${ano}${protocolo}`;
    }
    /**
     * Minuta conferida e incluída
     */
    incluirMinutaBV(method) {
        if (method == 'incluir') {
            const fundosPadraoAClaro2 = document.getElementsByClassName('fundoPadraoAClaro2');
            if (fundosPadraoAClaro2.length) {
                const estaPagina = this.pagina;
                window.setTimeout(function () {
                    if (window.confirm((fundosPadraoAClaro2[0].rows[0].cells[0].textContent || '').split(/\n/)[2] +
                        '\n\nDeseja incluir nova minuta?')) {
                        if (estaPagina == 'incluirMinutaBV') {
                            window.location.href = 'criarMinutaBVInclusao.do?method=criar';
                        }
                        else if (estaPagina == 'incluirMinutaSI') {
                            window.location.href = 'criarMinutaSIInclusao.do?method=criar';
                        }
                    }
                }, 0);
            }
        }
        else {
            throw new Error('Método desconhecido: ' + method);
        }
    }
    /**
     * Minuta conferida e incluída
     */
    incluirMinutaSI(method) {
        this.incluirMinutaBV(method);
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial -> Botão "Consultar" -> Evento "click"
     */
    onBotaoClick(e) {
        e.preventDefault();
        e.stopPropagation();
        this.submit = true;
        if (this.submit && this.valid && !this.buscando) {
            const numeroProcesso = query('[name="numeroProcesso"]');
            const numeroProtocolo = query('[name="numeroProtocolo"]');
            if (numeroProcesso) {
                numeroProcesso.select();
                numeroProcesso.focus();
            }
            else if (numeroProtocolo) {
                numeroProtocolo.select();
                numeroProtocolo.focus();
            }
            queryAll('form')[0].submit();
        }
    }
    /**
     * Função que atende ao evento change do Número do Processo
     */
    onConsultaProcessoChange(input) {
        const valor = input.value.toString();
        const numproc = this.getNumproc(valor);
        if (valor) {
            if (valor.match('/') && numproc) {
                input.value = 'Carregando...';
                this.buscando = {
                    valor: valor,
                };
                this.getInfo(numproc, 'consulta');
            }
            else if (numproc) {
                input.value = numproc;
                this.valid = true;
            }
            else {
                this.valid = false;
                window.alert('Número de processo inválido: "' + valor + '".');
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
        const valor = input.value.toString();
        const protocolo = this.getProtocolo(valor);
        if (valor && protocolo) {
            input.value = protocolo;
            this.valid = true;
        }
        else if (valor) {
            this.valid = false;
            window.alert('Número de protocolo inválido: "' + valor + '".');
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
        const valor = input.value.toString();
        queryAll('form')[0].reset();
        const reus = Array.from(query('[name="reus"]').getElementsByTagName('option'));
        reus.forEach(function (reu) {
            reu.selected = true;
        });
        if (reus.length) {
            if (this.pagina == 'criarMinutaBVInclusao') {
                window.wrappedJSObject.excluirReu();
            }
            else if (this.pagina == 'criarMinutaSIInclusao') {
                window.wrappedJSObject.excluirPessoa();
            }
        }
        if (valor) {
            input.value = 'Carregando...';
            const numproc = this.getNumproc(valor);
            if (numproc) {
                this.buscando = {
                    valor: valor,
                };
                this.getInfo(numproc, 'preencher');
            }
            else {
                window.alert('Número de processo inválido: "' + valor + '".');
                window.setTimeout(function () {
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
        if (e.keyCode == 9 || e.keyCode == 13) {
            e.preventDefault();
            e.stopPropagation();
            if (input.name == 'processo') {
                query('[name="idTipoAcao"]').focus();
            }
            else if (input.name == 'numeroProcesso' || input.name == 'numeroProtocolo') {
                this.submit = e.keyCode == 13 ? true : false;
                document.getElementsByClassName('botao')[0].focus();
                if (this.submit && this.valid && !this.buscando) {
                    input.select();
                    input.focus();
                    queryAll('form')[0].submit();
                }
            }
        }
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Processo Judicial -> Consultar
     *
     * @param String Método utilizado pela página
     */
    pesquisarPorProcesso(method) {
        if (method == 'pesquisarPorProcesso') {
            let erros;
            let msgErro = '';
            if ((erros = document.getElementsByClassName('msgErro')).length) {
                Array.from(erros).forEach(function (erro) {
                    erro.innerHTML = erro.innerHTML
                        .replace(/\n?•(\&nbsp;)?/g, '')
                        .replace('<b>', '&ldquo;')
                        .replace('</b>', '&rdquo;');
                    msgErro += erro.textContent + '\n';
                });
                window.alert(msgErro);
                history.go(-1);
            }
            else if (document.getElementsByClassName('pagebanner').length) {
                const registros = (document.getElementsByClassName('pagebanner')[0].textContent || '').match(/^\d+/);
                if (registros == 1) {
                    window.location.href = document
                        .getElementById('ordem')
                        .rows[1].cells[3].getElementsByTagName('a')[0].href;
                }
            }
        }
        else {
            throw new Error('Método desconhecido: ' + method);
        }
    }
    /**
     * Menu Ordens judiciais -> Consultar pelo Número do Protocolo Registrado no BacenJud -> Consultar
     */
    pesquisarPorProtocolo(method) {
        if (method == 'pesquisarPorProtocolo') {
            let erros;
            let msgErro = '';
            if ((erros = document.getElementsByClassName('msgErro')).length) {
                Array.from(erros).forEach(function (erro) {
                    erro.innerHTML = erro.innerHTML
                        .replace(/\n?•(\&nbsp;)?/g, '')
                        .replace('<b>', '&ldquo;')
                        .replace('</b>', '&rdquo;');
                    msgErro += erro.textContent + '\n';
                });
                window.alert(msgErro);
                history.go(-1);
            }
        }
        else {
            throw new Error('Método desconhecido: ' + method);
        }
    }
    /**
     * Preenche os campos com as informações obtidas
     *
     * @param GM_xmlhttpRequest Objeto retornado
     * @param String Modo de preenchimento
     * @param Object Opções passadas ao objeto
     */
    preencher(obj, modo) {
        if (modo != 'preencher' && modo != 'consulta') {
            throw new Error('Modo inválido: ' + modo);
        }
        const parser = new DOMParser();
        const ret = parser.parseFromString(obj.responseText, 'text/xml').querySelector('return')
            .textContent;
        const processo = parser.parseFromString(ret, 'text/xml');
        const erros = [];
        Array.prototype.slice.call(processo.querySelectorAll('Erro')).forEach(function (erro) {
            erros.push(erro.textContent);
        });
        const el = modo == 'preencher' ? 'processo' : 'numeroProcesso';
        const campoProcesso = query(`[name="${el}"]`);
        if (campoProcesso) {
            if (erros.length) {
                this.valid = false;
                window.alert(erros.join('\n'));
                campoProcesso.value = this.buscando.valor;
                this.buscando = false;
                campoProcesso.select();
                campoProcesso.focus();
            }
            else {
                this.valid = true;
                this.buscando = false;
                campoProcesso.value = processo
                    .querySelector('Processo Processo')
                    .textContent.replace(/[^0-9]/g, '');
                if (modo == 'preencher') {
                    if (processo.querySelector('CodClasse').textContent == '000229' ||
                        processo.querySelector('CodClasse').textContent == '000098') {
                        query('[name="idTipoAcao"]').value = 1;
                    }
                    else if (processo.querySelector('CodClasse').textContent == '000099') {
                        query('[name="idTipoAcao"]').value = 4;
                    }
                    if (query('[name="valorUnico"]') && processo.querySelector('ValCausa')) {
                        const valorCausa = Number(processo.querySelector('ValCausa').textContent);
                        if (!isNaN(valorCausa)) {
                            query('[name="valorUnico"]').value = formatNumber(valorCausa);
                        }
                    }
                    const reus = [];
                    Array.prototype.slice
                        .call(processo.querySelectorAll('Partes Parte'))
                        .forEach(function (parte) {
                        if (parte.querySelectorAll('Autor').length &&
                            parte.querySelector('Autor').textContent == 'S') {
                            query('[name="nomeAutor"]').value = parte.querySelector('Nome').textContent;
                            query('[name="cpfCnpjAutor"]').value = parte.querySelector('CPF_CGC').textContent;
                        }
                        else if ((parte.querySelectorAll('Réu').length &&
                            parte.querySelector('Réu').textContent == 'S') ||
                            (parte.querySelectorAll('Reu').length &&
                                parte.querySelector('Reu').textContent == 'S')) {
                            reus.push(parte.querySelector('CPF_CGC').textContent);
                        }
                    });
                    this.processaLista(reus);
                }
                else if (modo == 'consulta') {
                    if (this.submit) {
                        query('[name="numeroProcesso"]').select();
                        query('[name="numeroProcesso"]').focus();
                        queryAll('form')[0].submit();
                    }
                }
                else {
                    throw new Error('Modo desconhecido: ' + modo);
                }
            }
        }
    }
    /**
     * Adiciona os réus um a um
     */
    processaLista() {
        if (arguments.length) {
            this.reus = arguments[0];
            window.wrappedJSObject.processaLista = function () {
                Bacen.processaLista.apply(Bacen, []);
            };
        }
        if (this.reus.length) {
            const documento = this.reus[0].toString();
            this.reus.splice(0, 1);
            query('#cpfCnpj').value = documento;
            query('#botaoIncluirCpfCnpj').disabled = false;
            query('#botaoIncluirCpfCnpj').focus();
            (function (window) {
                const evento = document.createEvent('MouseEvents');
                evento.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
                query('#botaoIncluirCpfCnpj').dispatchEvent(evento);
            })(window.wrappedJSObject);
        }
        else if (query('[name="idTipoAcao"]') && query('[name="idTipoAcao"]').value == '') {
            query('[name="idTipoAcao"]').focus();
        }
        else if (query('[name="valorUnico"]')) {
            query('[name="valorUnico"]').select();
            query('[name="valorUnico"]').focus();
        }
    }
}
class Maybe {
    constructor(fold) {
        this.fold = fold;
    }
    ap(that) {
        return that.chain(f => this.map(f));
    }
    chain(f) {
        return this.fold(() => Nothing, f);
    }
    map(f) {
        return this.chain(x => Just(f(x)));
    }
    getOrElse(defaultValue) {
        return this.fold(() => defaultValue, x => x);
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
                        input.value = value || '';
                    });
                }
            });
        });
        this.initialized = true;
    }
    static obter(nome, valorPadrao) {
        const maybeValorPadrao = Maybe.fromNullable(valorPadrao);
        return browser.storage.local
            .get(nome)
            .then(prefs => Maybe.fromNullable(prefs[nome]))
            .then(maybe => maybeValorPadrao.fold(() => maybe, valor => maybe.getOrElse(valor)));
    }
    static async vincularInput(input, nome) {
        input.addEventListener('change', () => {
            const valor = input.value.trim();
            const promise = valor !== ''
                ? browser.storage.local.set({ [nome]: valor })
                : browser.storage.local.remove(nome);
            promise.catch(err => console.error(err));
        });
        this.inputs.set(nome, (this.inputs.get(nome) || []).concat([input]));
        const valor = await this.obter(nome);
        input.value = valor.getOrElse('');
    }
}
Preferencias.initialized = false;
Preferencias.inputs = new Map();
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
function query(selector, context = document) {
    return Maybe.fromNullable(context.querySelector(selector));
}
function queryAll(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
}
main();
