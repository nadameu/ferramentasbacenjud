function main() {
	carregarPreferencias().then(preferencias => analisarPagina(preferencias));
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
	partitionMap<L, U>(f: (_: T) => Either<L, U>): { left: Array<L>; right: Array<U> };
}
Array.prototype.filterMap = function(f) {
	const ys = [] as any[];
	this.forEach(x => f(x).fold(() => {}, y => ys.push(y)));
	return ys;
};
Array.prototype.partitionMap = function(f) {
	const result = { left: [] as any[], right: [] as any[] };
	this.forEach(x => f(x).fold(l => result.left.push(l), r => result.right.push(r)));
	return result;
};

// Classes

/**
 * Objeto principal do programa
 */
class Bacen {
	/**
	 * Página sendo exibida
	 */
	submit: boolean = false;
	valid: boolean = true;
	buscando: false | { valor: string } = false;
	reus: string[] = [];
	secao: Maybe<string> = Nothing;
	subsecao: Maybe<string> = Nothing;

	/**
	 * Função inicial do programa
	 */

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
		return Promise.all([
			queryInputByName(nomeInput),
			queryEither<HTMLInputElement>('input.botao'),
		]).then(([input, botao]) => {
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

		async function obterEFocar(nomeInput: string, nomePreferencia?: string) {
			const input = await queryInputByName(nomeInput);
			if (nomePreferencia === undefined) {
				input.focus();
				return;
			}
			return __Preferencias__.vincularInput(input, nomePreferencia, {
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
			return __Preferencias__.vincularInput(await queryInputByName(nomeInput), nomePreferencia, {
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
				return __Preferencias__.vincularInput(codigoVara, 'vara', {
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
				return __Preferencias__.vincularInput(cdOperadorJuiz, 'juiz', {
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
		return queryEither<HTMLTableCellElement>(selector)
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
				queryEither<HTMLFormElement>('form'),
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
		await queryEither<HTMLFormElement>('form')
			.then(form => {
				form.reset();
			})
			.catch(() => {});
		await queryEither<HTMLSelectElement>('select[name="reus"]').then(select => {
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
			queryEither<HTMLSelectElement>('select[name="idTipoAcao"]').then(idTipoAcao => {
				idTipoAcao.focus();
			});
		} else if (['numeroProcesso', 'numeroProtocolo'].includes(input.name)) {
			Promise.all([
				queryEither<HTMLInputElement>('input.botao'),
				queryEither<HTMLFormElement>('form'),
			]).then(([botao, form]) => {
				this.submit = e.keyCode == KeyCode.ENTER;
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
			queryEither('.pagebanner')
				.then(p => (p.textContent || '').match(/^\d+/))
				.then(x => (x === null ? Promise.reject() : Promise.resolve(x)))
				.then(xs => Number(xs[0]))
				.catch(() =>
					Promise.reject(new Error('Elemento ".pagebanner" não possui conteúdo numérico.'))
				),
			queryEither<HTMLTableElement>('table#ordem > tbody > tr:nth-child(1) > td:nth-child(3)').then(
				cell => queryEither<HTMLAnchorElement>('a', cell)
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
			.then(doc => queryEither('return', doc))
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
		await queryEither('Processo Processo', processo)
			.then(p => p.textContent || '')
			.then(txt => txt.replace(/[^0-9]/g, ''))
			.then(value => {
				campoProcesso.value = value;
			});
		if (modo == 'preencher') {
			const tipoAcaoPorCodClasse = new Map([['000229', '1'], ['000098', '1'], ['000099', '4']]);
			await Promise.all([
				queryEither<HTMLSelectElement>('select[name="idTipoAcao"]'),
				queryEither('CodClasse', processo).then(elt => elt.textContent || ''),
			]).then(([tipoAcao, codClasse]) => {
				if (tipoAcaoPorCodClasse.has(codClasse)) {
					tipoAcao.value = tipoAcaoPorCodClasse.get(codClasse) as string;
				}
			});
			await Promise.all([
				queryInputByName('valorUnico'),
				queryEither('ValCausa', processo)
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
					if ((await getText(queryEither('Autor', parte), 'N')) === 'S') {
						(await queryInputByName('nomeAutor')).value = await getText(
							queryEither('Nome', parte),
							''
						);
						(await queryInputByName('cpfCnpjAutor')).value = await getText(
							queryEither('CPF_CGC', parte),
							''
						);
					} else if (
						(await getText(
							queryEither('Réu', parte).catch(() => queryEither('Reu', parte)),
							'N'
						)) === 'S'
					) {
						reus.push(await getText(queryEither('CPF_CGC', parte), ''));
					}
				})
			);
			this.processaLista(reus);
		} else if (modo == 'consulta') {
			if (this.submit) {
				Promise.all([
					queryInputByName('numeroProcesso'),
					queryEither<HTMLFormElement>('form'),
				]).then(([processo, form]) => {
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
				queryEither<HTMLInputElement>('#cpfCnpj'),
				queryEither<HTMLInputElement>('#botaoIncluirCpfCnpj'),
			]).then(([cpf, botao]) => {
				cpf.value = documento;
				botao.disabled = false;
				botao.focus();
				botao.click();
			});
		} else {
			queryEither<HTMLSelectElement>('select[name="idTipoAcao"]')
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

class Either<L, R> {
	constructor(readonly fold: <B>(Left: (_: L) => B, Right: (_: R) => B) => B) {}

	ap<B>(that: Either<L, (_: R) => B>): Either<L, B> {
		return that.chain(f => this.map(f));
	}
	bimap<B, C>(f: (_: L) => B, g: (_: R) => C): Either<B, C> {
		return this.fold(l => Left(f(l)), r => Right(g(r)));
	}
	chain<B>(f: (_: R) => Either<L, B>): Either<L, B> {
		return this.fold(Left, f);
	}
	chainLeft<B>(f: (_: L) => Either<B, R>): Either<B, R> {
		return this.fold(f, Right);
	}
	map<B>(f: (_: R) => B): Either<L, B> {
		return this.fold(Left, x => Right(f(x)));
	}
	mapLeft<B>(f: (_: L) => B): Either<B, R> {
		return this.fold(x => Left(f(x)), Right);
	}

	static of<R, L = never>(value: R): Either<L, R> {
		return Right(value);
	}
}
function Left<L, R = never>(leftValue: L, _rightValue?: R): Either<L, R> {
	return new Either((L, _) => L(leftValue));
}
function Right<R, L = never>(rightValue: R, _leftValue?: L): Either<L, R> {
	return new Either((_, R) => R(rightValue));
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
	ifJust(f: (_: A) => void): void {
		this.fold(() => {}, f);
	}
	ifNothing(f: () => void): void {
		this.fold(f, () => {});
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

class __Preferencias__ {
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

function allEithers<L, A>(eithers: [Either<L, A>]): Either<L[], A[]>;
function allEithers<L, A, B>(eithers: [Either<L, A>, Either<L, B>]): Either<L[], [A, B]>;
function allEithers<L, A, B, C>(
	eithers: [Either<L, A>, Either<L, B>, Either<L, C>]
): Either<L[], [A, B, C]>;
function allEithers<L, A, B, C, D>(
	eithers: [Either<L, A>, Either<L, B>, Either<L, C>, Either<L, D>]
): Either<L[], [A, B, C, D]>;
function allEithers<L, A, B, C, D, E>(
	eithers: [Either<L, A>, Either<L, B>, Either<L, C>, Either<L, D>, Either<L, E>]
): Either<L[], [A, B, C, D, E]>;
function allEithers<L, A, B, C, D, E, F>(
	eithers: [Either<L, A>, Either<L, B>, Either<L, C>, Either<L, D>, Either<L, E>, Either<L, F>]
): Either<L[], [A, B, C, D, E, F]>;
function allEithers<L, A, B, C, D, E, F, G>(
	eithers: [
		Either<L, A>,
		Either<L, B>,
		Either<L, C>,
		Either<L, D>,
		Either<L, E>,
		Either<L, F>,
		Either<L, G>
	]
): Either<L[], [A, B, C, D, E, F, G]>;
function allEithers<L, A, B, C, D, E, F, G, H>(
	eithers: [
		Either<L, A>,
		Either<L, B>,
		Either<L, C>,
		Either<L, D>,
		Either<L, E>,
		Either<L, F>,
		Either<L, G>,
		Either<L, H>
	]
): Either<L[], [A, B, C, D, E, F, G, H]>;
function allEithers<L, A, B, C, D, E, F, G, H, I>(
	eithers: [
		Either<L, A>,
		Either<L, B>,
		Either<L, C>,
		Either<L, D>,
		Either<L, E>,
		Either<L, F>,
		Either<L, G>,
		Either<L, H>,
		Either<L, I>
	]
): Either<L[], [A, B, C, D, E, F, G, H, I]>;
function allEithers<L, A, B, C, D, E, F, G, H, I, J>(
	eithers: [
		Either<L, A>,
		Either<L, B>,
		Either<L, C>,
		Either<L, D>,
		Either<L, E>,
		Either<L, F>,
		Either<L, G>,
		Either<L, H>,
		Either<L, I>,
		Either<L, J>
	]
): Either<L[], [A, B, C, D, E, F, G, H, I, J]>;
function allEithers<L, A, B, C, D, E, F, G, H, I, J, K>(
	eithers: [
		Either<L, A>,
		Either<L, B>,
		Either<L, C>,
		Either<L, D>,
		Either<L, E>,
		Either<L, F>,
		Either<L, G>,
		Either<L, H>,
		Either<L, I>,
		Either<L, J>,
		Either<L, K>
	]
): Either<L[], [A, B, C, D, E, F, G, H, I, J, K]>;
function allEithers<L, A>(eithers: Either<L, A>[]): Either<L[], A[]> {
	const result = eithers.partitionMap(x => x);
	return result.left.length > 0 ? Left(result.left) : Right(result.right);
}

function analisarPagina(preferencias: PreferenciasObject) {
	const url = new URL(location.href);
	const pagina = url.pathname.split('/bacenjud2/')[1].split('.')[0];
	if (Paginas.has(pagina)) {
		const result = (Paginas.get(pagina) as (
			preferencias: PreferenciasObject,
			pagina: string
		) => Resultado)(preferencias, pagina);
		result.mapLeft(errors => {
			errors.forEach(error => console.error(error));
		});
	} else {
		console.log('Página desconhecida:', pagina);
	}
}

interface PreferenciasObject {
	get(name: Preferencias): Maybe<string>;
	observar(name: Preferencias, listener: (_: Maybe<string>) => void): void;
	set(name: Preferencias, value: string): Promise<void>;
	remove(name: Preferencias): Promise<void>;
}
const enum Preferencias {
	JUIZ = 'juiz',
	OPERADOR = 'operador',
	UNIDADE = 'unidade',
	SECAO = 'secao',
	SUBSECAO = 'subsecao',
	VARA = 'vara',
}
async function carregarPreferencias(): Promise<PreferenciasObject> {
	const preferencias = new Map<Preferencias, string>(
		await (browser.storage.local.get([
			Preferencias.JUIZ,
			Preferencias.OPERADOR,
			Preferencias.UNIDADE,
			Preferencias.SECAO,
			Preferencias.SUBSECAO,
			Preferencias.VARA,
		]) as Promise<{ [k in Preferencias]: string | undefined }>).then(
			prefs =>
				Object.entries(prefs).filter(
					(pair): pair is [Preferencias, string] => pair[1] !== undefined
				) as [Preferencias, string][]
		)
	);

	const listeners = new Map<Preferencias, ((_: Maybe<string>) => void)[]>();
	browser.storage.onChanged.addListener((changes, areaName) => {
		if (areaName !== 'local') return;
		const changedKeys = Object.keys(changes) as Preferencias[];
		changedKeys.forEach(key => {
			const result = (changes as any)[key] as browser.storage.StorageChange;
			if ('newValue' in result && typeof result.newValue === 'string') {
				preferencias.set(key, result.newValue);
			} else {
				preferencias.delete(key);
			}
			(listeners.get(key) || []).forEach(listener =>
				listener(Maybe.fromNullable(preferencias.get(key)))
			);
		});
	});

	return {
		get(name) {
			return Maybe.fromNullable(preferencias.get(name));
		},
		observar(name, listener) {
			listeners.set(name, (listeners.get(name) || []).concat([listener]));
			listener(this.get(name));
		},
		set(name, value) {
			return browser.storage.local.set({ [name]: value });
		},
		remove(name) {
			return browser.storage.local.remove(name);
		},
	};
}

function criarMinutaBVInclusao(preferencias: PreferenciasObject) {
	return allEithers([queryEither<HTMLFormElement>('form'), queryEither('#cpfCnpj')])
		.chain(([form, cpfCnpj]) => {
			const elts = form.elements;
			return allEithers([
				Right(form),
				queryCampo('cdOperadorJuiz'),
				queryCampo('idVara'),
				queryCampo('codigoVara'),
				queryCampo('processo'),
				queryCampo<HTMLSelectElement>('idTipoAcao'),
				queryCampo('nomeAutor'),
				queryCampo('cpfCnpjAutor'),
				Right(cpfCnpj),
				queryCampo<HTMLSelectElement>('reus'),
				queryCampo('valorUnico')
					.map(Just)
					.chainLeft(() => Right(Nothing)),
			]);

			function queryCampo<T extends Element = HTMLInputElement>(nome: string): Either<string, T> {
				const elt = elts.namedItem(nome) as T | null;
				return elt === null ? Left(`Campo não encontrado: "${nome}".`) : Right(elt);
			}
		})
		.map(
			([
				form,
				juiz,
				idVara,
				vara,
				processo,
				tipo,
				nomeAutor,
				docAutor,
				docReu,
				reus,
				maybeValor,
			]) => {
				[juiz, vara, processo, tipo, nomeAutor].forEach(campo => {
					campo.required = true;
				});
				maybeValor.ifJust(valor => {
					valor.required = true;
				});
				idVara.addEventListener('change', onIdVaraChange);
				if (idVara.value) onIdVaraChange();
				function onIdVaraChange() {
					vara.value = idVara.value;
				}
				preferencias.observar(Preferencias.JUIZ, maybe =>
					maybe.ifJust(value => {
						if (juiz.value === '') juiz.value = value;
					})
				);
				preferencias.observar(Preferencias.VARA, maybe =>
					maybe.ifJust(value => {
						if (vara.value === '') vara.value = value;
					})
				);
			}
		);
}

function dologin(preferencias: PreferenciasObject) {
	return queryEither<HTMLFormElement>('form')
		.mapLeft(err => [err])
		.chain(form => {
			const collection = form.elements;
			return allEithers([
				Right(form),
				queryCampo('unidade'),
				queryCampo('operador'),
				queryCampo('senha'),
				queryCampo<RadioNodeList>('opcao_login'),
			]);

			function queryCampo<T extends Element | RadioNodeList = HTMLInputElement>(
				name: string
			): Either<string, T> {
				const elt = collection.namedItem(name) as T | null;
				return elt === null ? Left(`Campo não encontrado: "${name}".`) : Right(elt);
			}
		})
		.map(([form, unidade, operador, senha, opcoesLogin]) => {
			preferencias.observar(Preferencias.UNIDADE, maybe => {
				unidade.setAttribute('placeholder', maybe.getOrElse(''));
			});
			preferencias.observar(Preferencias.OPERADOR, maybe => {
				operador.setAttribute('placeholder', maybe.getOrElse(''));
			});
			opcoesLogin.forEach(opcao => {
				opcao.addEventListener('click', focarCampoVazio);
			});
			window.addEventListener('load', focarCampoVazio);
			form.addEventListener('submit', () => {
				if (unidade.value === '') {
					unidade.value = preferencias.get(Preferencias.UNIDADE).getOrElse('');
				}
				if (operador.value === '') {
					operador.value = preferencias.get(Preferencias.OPERADOR).getOrElse('');
				}
			});

			class Campo {
				constructor(
					readonly input: HTMLInputElement,
					readonly preferencia?: Preferencias,
					readonly next?: Campo
				) {}
				concat(that: Campo): Campo {
					return new Campo(this.input, this.preferencia, this.next ? this.next.concat(that) : that);
				}
				focar() {
					Maybe.fromNullable(this.preferencia)
						.chain(preferencias.get)
						.mapNullable(() => this.next)
						.map(next => next.focar())
						.getOrElseL(() => {
							this.input.focus();
						});
				}
			}

			const camposAFocar = new Campo(unidade, Preferencias.UNIDADE)
				.concat(new Campo(operador, Preferencias.OPERADOR))
				.concat(new Campo(senha));

			function focarCampoVazio() {
				if (opcoesLogin.value === 'operador') {
					setTimeout(() => {
						camposAFocar.focar();
					}, 100);
				}
			}
		});
}

function formatNumber(num: number) {
	return num.toLocaleString('pt-BR', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
		minimumIntegerDigits: 1,
		useGrouping: true,
	});
}

function liftA2<L, A, B, C>(ex: Either<L, A>, ey: Either<L, B>, f: (x: A, y: B) => C): Either<L, C>;
function liftA2<A, B, C>(mx: Maybe<A>, my: Maybe<B>, f: (x: A, y: B) => C): Maybe<C>;
function liftA2<A, B, C>(ax: Apply<A>, ay: Apply<B>, f: (x: A, y: B) => C): Apply<C> {
	return ay.ap(ax.map((x: A) => (y: B) => f(x, y)));
}

function padLeft(size: number, number: number): string {
	let result = String(number);
	while (result.length < size) {
		result = `0${result}`;
	}
	return result;
}

function queryEither<T extends Element>(
	selector: string,
	context: NodeSelector = document
): Either<string, T> {
	const elt = context.querySelector<T>(selector);
	return elt === null ? Left(`Elemento não encontrado: '${selector}'.`) : Right(elt);
}

function queryAll<T extends Element>(selector: string, context: NodeSelector = document): T[] {
	return Array.from(context.querySelectorAll<T>(selector));
}

function queryMaybe<T extends Element>(
	selector: string,
	context: NodeSelector = document
): Maybe<T> {
	return Maybe.fromNullable(context.querySelector<T>(selector));
}

function queryInputByName(
	name: string,
	context: NodeSelector = document
): Either<string, HTMLInputElement> {
	const elt = context.querySelector<HTMLInputElement>(`input[name="${name}"]`);
	return elt === null ? Left(`Campo não encontrado: "${name}".`) : Right(elt);
}

// Constantes

type Resultado = Either<string[], void>;
const Paginas = new Map<string, (preferencias: PreferenciasObject, pagina: string) => Resultado>([
	['dologin', dologin],
	['conferirDadosMinutaBVInclusao', criarMinutaBVInclusao],
	['conferirDadosMinutaSIInclusao', criarMinutaBVInclusao],
	['criarMinutaBVInclusao', criarMinutaBVInclusao],
	['criarMinutaSIInclusao', criarMinutaBVInclusao],
]);

main();
