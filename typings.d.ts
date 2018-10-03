interface Window {
	wrappedJSObject: UnsafeWindow;
}

interface UnsafeWindow extends Window {
	abreConsultarCpfCnpjPopUp(): void;
	excluirPessoa(): void;
	excluirReu(): void;
	processaLista(): void;
}
