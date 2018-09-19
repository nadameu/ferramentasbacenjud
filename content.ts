function main() {
	Preferencias.init();
	new Bacen();
}

// Interfaces

interface Apply<A> {
	ap<B>(that: Apply<(_: A) => B>): Apply<B>;
	map<B>(f: (_: A) => B): Apply<B>;
}
interface Semigroup {
	concat(that: Semigroup): Semigroup;
}

type ResultadoNumproc =
	| { ok: false; motivo: 'erroDigitacaoAbreviada'; valorInformado: string }
	| { ok: false; motivo: 'erroSecaoSubsecao' }
	| { ok: false; motivo: 'erroDigitacao'; valorInformado: string }
	| { ok: true; valor: string };

interface Array<T> {
	concat(that: Array<T>): Array<T>;
	filterMap<U>(f: (_: T) => Maybe<U>): Array<U>;
}
Array.prototype.filterMap = function(f) {
	return this.reduce((ys, x) => f(x).fold(() => ys, y => (ys.push(y), ys)), []);
};

// Classes

/**
 * Objeto principal do programa
 */
class Bacen {
	/**
	 * Página sendo exibida
	 */
	pagina: string;
	submit: boolean = false;
	valid: boolean = true;
	buscando: false | { valor: string } = false;
	reus: string[] = [];
	secao: Maybe<string> = Nothing;
	subsecao: Maybe<string> = Nothing;

	/**
	 * Função inicial do programa
	 */
	constructor() {
		const url = new URL(location.href);
		this.pagina = url.pathname.split('/bacenjud2/')[1].split('.')[0];
		const parametros = url.searchParams;
		const method = parametros.get('method') || '';
		if (this.pagina in this && typeof (this as any)[this.pagina] === 'function') {
			const result = (this as any)[this.pagina](method) as Promise<void>;
			result.catch(err => console.error(err));
		}
		observarPreferencia(this, 'secao');
		observarPreferencia(this, 'subsecao');

		function observarPreferencia<K extends keyof Bacen>(bacen: Bacen, nome: K) {
			Preferencias.observar(nome, (maybe: Bacen[K]) => {
				bacen[nome] = maybe;
			});
		}
	}

	/**
	 * Menu Minutas -> Incluir Minuta de Bloqueio de Valores -> Conferir dados da Minuta
	 */
	async conferirDadosMinutaBVInclusao() {
		await this.tratarErros().catch(err =>
			this.criarMinutaBVInclusao().then(() => Promise.reject(err))
		);
		try {
			(await obterSenhaJuiz()).focus();
		} catch (errSenhaJuiz) {
			const btnIncluir = await queryInputByName('btnIncluir');
			window.addEventListener('keypress', e => {
				if (e.keyCode !== KeyCode.ENTER) return;
				e.preventDefault();
				e.stopPropagation();
				btnIncluir.click();
			});
		}

		function obterSenhaJuiz() {
			return queryInputByName('senhaJuiz').then(
				senhaJuiz =>
					senhaJuiz.disabled
						? Promise.reject(new Error('Campo "senhaJuiz" desabilitado.'))
						: Promise.resolve(senhaJuiz)
			);
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

	consultarSolicitacoesProtocoladas(nomeInput: string, tipo: 'processo' | 'protocolo') {
		return Promise.all([queryInputByName(nomeInput), query<HTMLInputElement>('input.botao')]).then(
			([input, botao]) => {
				input.focus();
				input.addEventListener(
					'change',
					() =>
						tipo === 'processo'
							? this.onConsultaProcessoChange(input)
							: this.onConsultaProtocoloChange(input)
				);
				input.addEventListener('keypress', e => this.onProcessoKeypress(e, input));
				botao.addEventListener('click', e => this.onBotaoClick(e));
			}
		);
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

		async function obterEFocar(nomeInput: string, nomePreferencia?: string) {
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

		async function vincular(nomeInput: string, nomePreferencia: string) {
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
		window.addEventListener('unload', () =>
			Promise.resolve()
				.then(
					() =>
						window.opener &&
						typeof window.opener === 'object' &&
						window.opener !== null &&
						!window.opener.closed &&
						(window.opener as Window).postMessage('processaLista', location.origin)
				)
				.catch(err => console.error(err))
		);
		window.addEventListener('keypress', e =>
			Promise.resolve()
				.then(() => {
					if (e.keyCode == KeyCode.ESCAPE) {
						window.close();
					}
				})
				.catch(err => console.error(err))
		);
	}

	/**
	 * Menu Minutas -> Incluir Minuta de Bloqueio de Valores
	 */
	async criarMinutaBVInclusao() {
		const erros = [] as Error[];
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
			.then(
				input =>
					input.type === 'hidden'
						? Promise.reject(new Error('Campo "cdOperadorJuiz" oculto.'))
						: Promise.resolve(input)
			)
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

	dologin(_: string) {
		return Promise.all([
			queryInputByName('unidade'),
			queryInputByName('operador'),
			queryInputByName('senha'),
			query<HTMLInputElement>('#opcao_operador'),
		]).then(([unidade, operador, senha, radio]) => vincularCampos(unidade, operador, senha, radio));

		async function vincularCampos(
			unidade: HTMLInputElement,
			operador: HTMLInputElement,
			senha: HTMLInputElement,
			radio: HTMLInputElement
		) {
			await Promise.all([
				Preferencias.vincularInput(unidade, 'unidade'),
				Preferencias.vincularInput(operador, 'login'),
			]);
			window.addEventListener('load', preencher(senha, operador, unidade));
			radio.addEventListener('click', preencher(senha, operador, unidade));
		}

		function preencher(
			senha: HTMLInputElement,
			operador: HTMLInputElement,
			unidade: HTMLInputElement
		): EventListener {
			return () => setTimeout(() => preencherCampos(senha, operador, unidade), 100);
		}

		async function preencherCampos(
			senha: HTMLInputElement,
			operador: HTMLInputElement,
			unidade: HTMLInputElement
		) {
			// Ordem dos campos de trás para frente, pois o último campo não preenchido restará focado.
			senha.focus();
			await preencherCampo(operador, 'login');
			await preencherCampo(unidade, 'unidade');
		}

		async function preencherCampo(input: HTMLInputElement, nome: string) {
			const pref = await Preferencias.obter(nome);
			pref.fold(
				() => {
					input.value = '';
					input.focus();
				},
				x => {
					input.value = x;
				}
			);
		}
	}

	/**
	 * Obtém informações do processo e preenche automaticamente os campos
	 */
	async getInfo(numproc: string, modo: 'consulta' | 'preencher') {
		const estados = new Map([['70', 'PR'], ['71', 'RS'], ['72', 'SC']]);
		const estado = estados.get(this.secao.getOrElse('')) || 'SC';
		if (![10, 15, 20].includes(numproc.length)) {
			throw new Error('Número de processo inválido: ' + numproc);
		}
		const todas_partes = modo == 'preencher' ? 'S' : 'N';
		// WSDL: http://www.trf4.jus.br/trf4/processos/acompanhamento/ws_consulta_processual.php
		const response = await fetch(
			'https://www.trf4.jus.br/trf4/processos/acompanhamento/consultaws.php',
			{
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
			}
		);
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
	getNumproc(input: string): ResultadoNumproc {
		const numproc = input.replace(/[^0-9\/]/g, '');
		if (/^(\d{2}|\d{4})\/\d{2,9}$/.test(numproc)) {
			const [anoDigitado, numeroDigitado] = numproc.split('/');
			let ano = Number(anoDigitado);
			if (ano < 50) {
				ano = ano + 2000;
			} else if (ano >= 50 && ano < 100) {
				ano = ano + 1900;
			}
			const qtdDigitosVerificadores = ano >= 2010 ? 2 : 1;
			const numero = Number(
				numeroDigitado.slice(0, numeroDigitado.length - qtdDigitosVerificadores)
			);
			const ramo = '4';
			const tribunal = '04';
			return liftA2(this.secao, this.subsecao, (secao, subsecao) => {
				const r1 = Number(numero) % 97;
				const r2 = Number([r1, ano, ramo, tribunal].join('')) % 97;
				const r3 = Number([r2, secao, subsecao, '00'].join('')) % 97;
				let dv = padLeft(2, 98 - r3);
				return [padLeft(7, numero), dv, ano, ramo, tribunal, secao, subsecao].join('');
			})
				.map(valor => ({ ok: true, valor } as ResultadoNumproc))
				.getOrElse({ ok: false, motivo: 'erroSecaoSubsecao' });
		} else if (numproc.match('/')) {
			return { ok: false, motivo: 'erroDigitacaoAbreviada', valorInformado: input };
		} else if ([10, 15, 20].includes(numproc.length)) {
			return { ok: true, valor: numproc };
		} else {
			return { ok: false, motivo: 'erroDigitacao', valorInformado: input };
		}
	}

	/**
	 * Retorna o número do protocolo
	 */
	getProtocolo(input: string): ResultadoNumproc {
		const protocolo = input.replace(/[^0-9\/]/g, '');
		if (/^(\d{2}|\d{4})\/\d{1,10}$/.test(protocolo)) {
			const [anoDigitado, numeroDigitado] = protocolo.split('/');
			let ano = Number(anoDigitado);
			if (ano < 50) {
				ano = ano + 2000;
			} else if (ano >= 50 && ano < 100) {
				ano = ano + 1900;
			}
			const numero = Number(numeroDigitado);
			return { ok: true, valor: `${(padLeft(4, ano), padLeft(10, numero))}` };
		} else if (protocolo.match('/')) {
			return { ok: false, motivo: 'erroDigitacaoAbreviada', valorInformado: input };
		} else if (protocolo.length == 14) {
			return { ok: true, valor: protocolo };
		} else if (protocolo.length >= 1 && protocolo.length <= 10) {
			const ano = new Date().getFullYear();
			const numero = Number(protocolo);
			return { ok: true, valor: `${padLeft(4, ano)}${padLeft(10, numero)}` };
		} else {
			return { ok: false, motivo: 'erroDigitacao', valorInformado: input };
		}
	}

	incluirMinuta(tipoMinuta: 'BV' | 'SI') {
		const paginaInclusao = `criarMinuta${tipoMinuta}Inclusao.do?method=criar`;
		const selector = 'table.fundoPadraoAClaro2 > tbody > tr:first-child > td:first-child';
		return query<HTMLTableCellElement>(selector)
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
	onBotaoClick(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		this.submit = true;
		if (this.submit && this.valid && !this.buscando) {
			Promise.all([
				queryInputByName('numeroProcesso').catch((err1: Error) =>
					queryInputByName('numeroProtocolo').catch((err2: Error) =>
						Promise.reject(new Error([err1, err2].map(x => x.message).join('\n')))
					)
				),
				query<HTMLFormElement>('form'),
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
	onConsultaProcessoChange(input: HTMLInputElement) {
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
			window.setTimeout(function() {
				input.value = valor;
				input.select();
				input.focus();
			}, 100);
		}
	}

	/**
	 * Função que atende ao evento change do Número do Protocolo
	 */
	onConsultaProtocoloChange(input: HTMLInputElement) {
		const valor = input.value;
		const protocolo = this.getProtocolo(valor);
		if (valor && protocolo.ok) {
			input.value = protocolo.valor;
			this.valid = true;
		} else if (valor) {
			this.valid = false;
			alert('Número de protocolo inválido: "' + valor + '".');
			window.setTimeout(function() {
				input.select();
				input.focus();
			}, 100);
		}
	}

	/**
	 * Função que atende ao evento change do Número do Processo
	 */
	async onProcessoChange(input: HTMLInputElement) {
		const valor = input.value;
		await queryInputByName('cdOperadorJuiz')
			.then(cdOperadorJuiz => {
				if (cdOperadorJuiz.type !== 'hidden') {
					cdOperadorJuiz.setAttribute('value', cdOperadorJuiz.value);
				}
			})
			.catch(() => {});
		await queryInputByName('codigoVara')
			.then(codigoVara => {
				codigoVara.setAttribute('value', codigoVara.value);
			})
			.catch(() => {});
		await query<HTMLFormElement>('form')
			.then(form => {
				form.reset();
			})
			.catch(() => {});
		await query<HTMLSelectElement>('select[name="reus"]').then(select => {
			const reus = Array.from(select.options);
			if (reus.length) {
				reus.forEach(reu => (reu.selected = true));
				if (['criarMinutaBVInclusao', 'conferirDadosMinutaBVInclusao'].includes(this.pagina)) {
					window.wrappedJSObject.excluirReu();
				} else if (
					['criarMinutaSIInclusao', 'conferirDadosMinutaSIInclusao'].includes(this.pagina)
				) {
					window.wrappedJSObject.excluirPessoa();
				} else {
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
			} else {
				switch (numproc.motivo) {
					case 'erroDigitacao':
					case 'erroDigitacaoAbreviada':
						alert(`Formato de número de processo desconhecido: ${numproc.valorInformado}`);
						break;
					case 'erroSecaoSubsecao':
						alert(
							'Para utilizar a digitação abreviada é preciso preencher os códigos de Seção e Subseção nas preferências da extensão.'
						);
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
	onProcessoKeypress(e: KeyboardEvent, input: HTMLInputElement) {
		console.log('keypress', e.keyCode);
		if (![KeyCode.TAB, KeyCode.ENTER].includes(e.keyCode)) return;
		e.preventDefault();
		e.stopPropagation();
		if (input.name === 'processo') {
			query<HTMLSelectElement>('select[name="idTipoAcao"]').then(idTipoAcao => {
				idTipoAcao.focus();
			});
		} else if (['numeroProcesso', 'numeroProtocolo'].includes(input.name)) {
			Promise.all([query<HTMLInputElement>('input.botao'), query<HTMLFormElement>('form')]).then(
				([botao, form]) => {
					this.submit = e.keyCode == KeyCode.ENTER;
					botao.focus();
					if (this.submit && this.valid && !this.buscando) {
						input.select();
						input.focus();
						form.submit();
					}
				}
			);
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
				.catch(() =>
					Promise.reject(new Error('Elemento ".pagebanner" não possui conteúdo numérico.'))
				),
			query<HTMLTableElement>('table#ordem > tbody > tr:nth-child(1) > td:nth-child(3)').then(
				cell => query<HTMLAnchorElement>('a', cell)
			),
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
	async preencher(text: string, modo: 'preencher' | 'consulta') {
		const parser = new DOMParser();
		const el = modo == 'preencher' ? 'processo' : 'numeroProcesso';
		const processo = await Promise.resolve(text)
			.then(txt => parser.parseFromString(txt, 'text/xml') as XMLDocument)
			.then(doc => query('return', doc))
			.then(ret => ret.textContent || '')
			.then(ret => parser.parseFromString(ret, 'text/xml') as XMLDocument);

		const campoProcesso = await queryInputByName(el);
		const erros = queryAll('Erro', processo)
			.map(erro => erro.textContent || '')
			.filter(texto => texto.trim() !== '');
		if (erros.length) {
			this.valid = false;
			const msg = erros.join('\n');
			alert(msg);
			campoProcesso.value = (this.buscando as { valor: string }).valor;
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
				query<HTMLSelectElement>('select[name="idTipoAcao"]'),
				query('CodClasse', processo).then(elt => elt.textContent || ''),
			]).then(([tipoAcao, codClasse]) => {
				if (tipoAcaoPorCodClasse.has(codClasse)) {
					tipoAcao.value = tipoAcaoPorCodClasse.get(codClasse) as string;
				}
			});
			await Promise.all([
				queryInputByName('valorUnico'),
				query('ValCausa', processo)
					.then(elt => elt.textContent || '')
					.then(Number)
					.then(
						x =>
							isNaN(x) || x === 0
								? Promise.reject('Campo "ValCausa" não é um número válido.')
								: Promise.resolve(x)
					)
					.then(formatNumber),
			])
				.then(([campoValor, valor]) => {
					campoValor.value = valor;
				})
				.catch(err => console.error(err));
			const reus: string[] = [];
			function getText(p: Promise<Node>, defaultValue: string) {
				return p
					.then(x => x.textContent)
					.then(txt => (txt === null ? Promise.reject() : Promise.resolve(txt)))
					.catch(() => defaultValue);
			}
			await Promise.all(
				queryAll('Partes Parte', processo).map(async parte => {
					if ((await getText(query('Autor', parte), 'N')) === 'S') {
						(await queryInputByName('nomeAutor')).value = await getText(query('Nome', parte), '');
						(await queryInputByName('cpfCnpjAutor')).value = await getText(
							query('CPF_CGC', parte),
							''
						);
					} else if (
						(await getText(query('Réu', parte).catch(() => query('Reu', parte)), 'N')) === 'S'
					) {
						reus.push(await getText(query('CPF_CGC', parte), ''));
					}
				})
			);
			this.processaLista(reus);
		} else if (modo == 'consulta') {
			if (this.submit) {
				Promise.all([queryInputByName('numeroProcesso'), query<HTMLFormElement>('form')]).then(
					([processo, form]) => {
						processo.select();
						processo.focus();
						form.submit();
					}
				);
			}
		}
	}

	/**
	 * Adiciona os réus um a um
	 */
	processaLista(reus?: string[]) {
		if (reus !== undefined) {
			this.reus = reus;
			window.addEventListener('message', evt => {
				if (evt.origin === location.origin && evt.data === 'processaLista') {
					this.processaLista();
				}
			});
		}
		if (this.reus.length) {
			const documento = this.reus.shift() as string;
			Promise.all([
				query<HTMLInputElement>('#cpfCnpj'),
				query<HTMLInputElement>('#botaoIncluirCpfCnpj'),
			]).then(([cpf, botao]) => {
				cpf.value = documento;
				botao.disabled = false;
				botao.focus();
				botao.click();
			});
		} else {
			query<HTMLSelectElement>('select[name="idTipoAcao"]')
				.then(input => (input.value === '' ? Promise.resolve(input) : Promise.reject()))
				.then(input => {
					input.focus();
				})
				.catch(() =>
					queryInputByName('valorUnico').then(input => {
						input.select();
						input.focus();
					})
				);
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

class Validation<A> {
	constructor(readonly fold: <B>(Failure: (_: string[]) => B, Success: (_: A) => B) => B) {}

	altL(lazy: () => Validation<A>): Validation<A> {
		return this.fold(
			theseErrors => lazy().fold(thoseErrors => Failure(theseErrors.concat(thoseErrors)), Success),
			Success
		);
	}
	ap<B>(that: Validation<(_: A) => B>): Validation<B> {
		return this.fold(
			theseErrors =>
				Failure(that.fold(thoseErrors => theseErrors.concat(thoseErrors), () => theseErrors)),
			x => that.fold(Failure, f => Success(f(x)))
		);
	}
	chain<B>(f: (_: A) => Validation<B>): Validation<B> {
		return this.fold(Failure, f);
	}
	map<B>(f: (_: A) => B): Validation<B> {
		return this.fold(Failure, x => Success(f(x)));
	}

	static fail<A = never>(error: string): Validation<A> {
		return Failure([error]);
	}
	static of<A>(value: A): Validation<A> {
		return Success(value);
	}
}
function Failure<A = never>(errors: string[]): Validation<A> {
	return new Validation((F, _) => F(errors));
}
function Success<A>(value: A): Validation<A> {
	return new Validation((_, S) => S(value));
}

const enum KeyCode {
	TAB = 9,
	ENTER = 13,
	ESCAPE = 27,
}

class Maybe<A> {
	constructor(readonly fold: <B>(Nothing: () => B, Just: (value: A) => B) => B) {}

	alt(that: Maybe<A>): Maybe<A> {
		return this.fold(() => that, Maybe.of);
	}
	altL(lazy: () => Maybe<A>): Maybe<A> {
		return this.fold(lazy, () => this);
	}
	ap<B>(that: Maybe<(_: A) => B>): Maybe<B> {
		return that.chain(f => this.map(f));
	}
	chain<B>(f: (_: A) => Maybe<B>): Maybe<B> {
		return this.fold(() => Nothing, f);
	}
	concat<S extends Semigroup>(this: Maybe<S>, that: Maybe<S>): Maybe<S> {
		return this.fold(() => that, xs => that.map(ys => xs.concat(ys) as S));
	}
	filter<B extends A>(p: (value: A) => value is B): Maybe<B>;
	filter(p: (_: A) => boolean): Maybe<A>;
	filter(p: (_: A) => boolean): Maybe<A> {
		return this.fold(() => Nothing, x => (p(x) ? Just(x) : Nothing));
	}
	map<B>(f: (_: A) => B): Maybe<B> {
		return this.chain(x => Just(f(x)));
	}
	mapNullable<B>(f: (_: A) => B | null | undefined): Maybe<B> {
		return this.chain(x => Maybe.fromNullable(f(x)));
	}
	getOrElse(defaultValue: A): A {
		return this.fold(() => defaultValue, x => x);
	}
	getOrElseL(lazy: () => A): A {
		return this.fold(lazy, x => x);
	}

	static fromNullable<A>(value: A | null | undefined): Maybe<A> {
		return value == null ? Nothing : Just(value);
	}
	static of<A>(value: A): Maybe<A> {
		return new Maybe((_, J) => J(value));
	}
	static zero<A = never>(): Maybe<A> {
		return new Maybe((N, _) => N());
	}
}
function Just<A>(value: A): Maybe<A> {
	return Maybe.of(value);
}
const Nothing = Maybe.zero();

class Preferencias {
	static initialized: boolean = false;
	static inputs: Map<string, HTMLInputElement[]> = new Map();
	static callbacks: Map<string, ((_: Maybe<string>) => void)[]> = new Map();

	static init() {
		if (this.initialized) return;
		browser.storage.onChanged.addListener((changes, areaName) => {
			if (areaName !== 'local') return;
			const changed = Object.keys(changes);
			changed.forEach(key => {
				const value = (changes as any)[key].newValue as string | undefined;
				if (this.inputs.has(key)) {
					(this.inputs.get(key) as HTMLInputElement[]).forEach(input => {
						if (input.value.trim() === '') {
							input.value = value || '';
						}
					});
				}
				const maybeValue = Maybe.fromNullable(value);
				if (this.callbacks.has(key)) {
					(this.callbacks.get(key) as ((_: Maybe<string>) => void)[]).forEach(callback => {
						callback(maybeValue);
					});
				}
			});
		});
		this.initialized = true;
	}

	static observar(nome: string, callback: (_: Maybe<string>) => void) {
		this.callbacks.set(nome, (this.callbacks.get(nome) || []).concat(callback));
		return this.obter(nome).then(callback);
	}

	static obter(nome: string, valorPadrao: string): Promise<string>;
	static obter(nome: string): Promise<Maybe<string>>;
	static obter(nome: string, valorPadrao?: string) {
		const maybeValorPadrao = Maybe.fromNullable(valorPadrao);
		return browser.storage.local
			.get(nome)
			.then(prefs => Maybe.fromNullable(prefs[nome] as string | undefined))
			.then(maybe => maybeValorPadrao.fold<any>(() => maybe, valor => maybe.getOrElse(valor)));
	}

	static async vincularInput(
		input: HTMLInputElement,
		nome: string,
		opcoes: { focarSeVazio: boolean; salvarAoPreencher: boolean } = {
			focarSeVazio: false,
			salvarAoPreencher: true,
		}
	) {
		if (opcoes.salvarAoPreencher) {
			input.addEventListener('change', () => {
				const valor = input.value.trim();
				const promise =
					valor !== ''
						? browser.storage.local.set({ [nome]: valor })
						: browser.storage.local.remove(nome);
				promise.catch(err => console.error(err));
			});
		}
		this.inputs.set(nome, (this.inputs.get(nome) || []).concat([input]));
		const valor = await this.obter(nome);
		valor.fold(
			() => {
				input.value = '';
				if (opcoes.focarSeVazio) input.focus();
			},
			x => {
				input.value = x;
			}
		);
	}
}

class QueryError extends Error {
	constructor(msg: string, readonly data: any) {
		super(msg);
	}
}

// Funções

function assertStrictEquals<T>(expected: T, actual: T): Validation<T> {
	if (actual !== expected) {
		return Validation.fail(`"${actual}" !== "${expected}".`);
	}
	return Validation.of(actual);
}

function formatNumber(num: number) {
	return num.toLocaleString('pt-BR', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
		minimumIntegerDigits: 1,
		useGrouping: true,
	});
}

function liftA<A, B>(mx: Maybe<A>, f: (x: A) => B): Maybe<B>;
function liftA<A, B>(ax: Apply<A>, f: (x: A) => B): Apply<B> {
	return ax.map(f);
}

function liftA2<A, B, C>(mx: Maybe<A>, my: Maybe<B>, f: (x: A, y: B) => C): Maybe<C>;
function liftA2<A, B, C>(ax: Apply<A>, ay: Apply<B>, f: (x: A, y: B) => C): Apply<C> {
	return ay.ap(ax.map((x: A) => (y: B) => f(x, y)));
}

function liftA3<A, B, C, D>(
	mx: Maybe<A>,
	my: Maybe<B>,
	mz: Maybe<C>,
	f: (x: A, y: B, z: C) => D
): Maybe<D>;
function liftA3<A, B, C, D>(
	ax: Apply<A>,
	ay: Apply<B>,
	az: Apply<C>,
	f: (x: A, y: B, z: C) => D
): Apply<D> {
	return az.ap(ay.ap(ax.map((x: A) => (y: B) => (z: C) => f(x, y, z))));
}

function liftA4<A, B, C, D, E>(
	mw: Maybe<A>,
	mx: Maybe<B>,
	my: Maybe<C>,
	mz: Maybe<D>,
	f: (w: A, x: B, y: C, z: D) => E
): Maybe<E>;
function liftA4<A, B, C, D, E>(
	aw: Apply<A>,
	ax: Apply<B>,
	ay: Apply<C>,
	az: Apply<D>,
	f: (w: A, x: B, y: C, z: D) => E
): Apply<E> {
	return az.ap(ay.ap(ax.ap(aw.map((w: A) => (x: B) => (y: C) => (z: D) => f(w, x, y, z)))));
}

function padLeft(size: number, number: number): string {
	let result = String(number);
	while (result.length < size) {
		result = `0${result}`;
	}
	return result;
}

function query<T extends Element>(selector: string, context: NodeSelector = document): Promise<T> {
	return new Promise((res, rej) => {
		const elt = context.querySelector<T>(selector);
		if (!elt) {
			return rej(new QueryError(`Elemento não encontrado: '${selector}'.`, { context, selector }));
		}
		return res(elt);
	});
}

function queryAll<T extends Element>(selector: string, context: NodeSelector = document): T[] {
	return Array.from(context.querySelectorAll<T>(selector));
}

function queryMaybe<T extends Element>(
	selector: string,
	context: NodeSelector = document
): never[] | [T] {
	const elt = context.querySelector<T>(selector);
	return elt === null ? [] : [elt];
}

function queryInputByName(
	name: string,
	context: NodeSelector = document
): Promise<HTMLInputElement> {
	return new Promise((res, rej) => {
		const elt = context.querySelector<HTMLInputElement>(`input[name="${name}"]`);
		if (!elt) {
			return rej(new QueryError(`Campo não encontrado: "${name}".`, { context, name }));
		}
		return res(elt);
	});
}

main();
