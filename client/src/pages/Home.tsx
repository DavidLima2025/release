import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Copy, Download, Palette } from "lucide-react";
import { toast } from "sonner";

interface Policial {
  id: string;
  nome: string;
  patente: string;
}

interface Equipe {
  id: string;
  nome: string;
  tipo: string;
  policiais: Policial[];
}

interface FormatConfig {
  emojiNatureza: string;
  emojiLocal: string;
  emojiReds: string;
  emojiHora: string;
  emojiEquipe: string;
  emojiPolicial: string;
  emojiMaterial: string;
  emojiAutor: string;
  emojiHistorico: string;
  estilo: "padrao" | "minimalista" | "detalhado";
}

const EMOJI_OPTIONS = {
  natureza: ["⚖️", "📋", "🚨", "⚠️"],
  local: ["📍", "🏠", "📌", "🗺️"],
  reds: ["📋", "📄", "📑", "🔢"],
  hora: ["⏰", "🕐", "⌚", "⏱️"],
  equipe: ["🚓", "🏍️", "👁️", "🚶", "🦉"],
  policial: ["👮🏻‍♂️", "👮", "👤", "🕵️"],
  material: ["📦", "🎁", "📫", "🛍️"],
  autor: ["🔗", "🔓", "👤", "⛓️"],
  historico: ["📜", "📝", "📖", "📚"],
};

export default function Home() {
  const [cia, setCia] = useState("6ª CIA PMMG");
  const [naturezas, setNaturezas] = useState<string[]>([]);
  const [novanatureza, setNovanatureza] = useState("");
  const [hora, setHora] = useState("");
  const [local, setLocal] = useState("");
  const [reds, setReds] = useState("");
  const [equipeType, setEquipeType] = useState("🏍️");
  const [equipeNome, setEquipeNome] = useState("");
  const [guarnicao, setGuarnicao] = useState<Policial[]>([]);
  const [apoio, setApoio] = useState<Equipe[]>([]);
  const [materialApreendido, setMaterialApreendido] = useState("");
  const [autores, setAutores] = useState("");
  const [historico, setHistorico] = useState("");
  const [novoPolicial, setNovoPolicial] = useState({ nome: "", patente: "SD" });
  const [novaEquipeApoio, setNovaEquipeApoio] = useState({ nome: "", tipo: "🚓" });
  const [novoPoliciaiApoio, setNovoPoliciaiApoio] = useState({ nome: "", patente: "SD" });
  const [equipeApoioSelecionada, setEquipeApoioSelecionada] = useState<string | null>(null);
  const [showFormatConfig, setShowFormatConfig] = useState(false);
  const [formatConfig, setFormatConfig] = useState<FormatConfig>({
    emojiNatureza: "⚖️",
    emojiLocal: "📍",
    emojiReds: "📋",
    emojiHora: "⏰",
    emojiEquipe: "🏍️",
    emojiPolicial: "👮🏻‍♂️",
    emojiMaterial: "📦",
    emojiAutor: "🔗",
    emojiHistorico: "📜",
    estilo: "padrao",
  });

  const adicionarNatureza = () => {
    if (novanatureza.trim()) {
      setNaturezas([...naturezas, novanatureza]);
      setNovanatureza("");
    }
  };

  const removerNatureza = (index: number) => {
    setNaturezas(naturezas.filter((_, i) => i !== index));
  };

  const adicionarPolicial = (tipo: "guarnicao" | "apoio") => {
    if (tipo === "guarnicao" && novoPolicial.nome.trim()) {
      setGuarnicao([...guarnicao, { ...novoPolicial, id: Date.now().toString() }]);
      setNovoPolicial({ nome: "", patente: "SD" });
    } else if (tipo === "apoio" && equipeApoioSelecionada && novoPoliciaiApoio.nome.trim()) {
      const novaApoio = apoio.map((eq) => {
        if (eq.id === equipeApoioSelecionada) {
          return {
            ...eq,
            policiais: [...eq.policiais, { ...novoPoliciaiApoio, id: Date.now().toString() }],
          };
        }
        return eq;
      });
      setApoio(novaApoio);
      setNovoPoliciaiApoio({ nome: "", patente: "SD" });
    }
  };

  const removerPolicial = (id: string) => {
    setGuarnicao(guarnicao.filter((p) => p.id !== id));
  };

  const removerPoliciaiApoio = (equipeId: string, policiaiId: string) => {
    const novaApoio = apoio.map((eq) => {
      if (eq.id === equipeId) {
        return {
          ...eq,
          policiais: eq.policiais.filter((p) => p.id !== policiaiId),
        };
      }
      return eq;
    });
    setApoio(novaApoio);
  };

  const adicionarEquipeApoio = () => {
    if (novaEquipeApoio.nome.trim()) {
      const novaEquipe: Equipe = {
        ...novaEquipeApoio,
        id: Date.now().toString(),
        policiais: [],
      };
      setApoio([...apoio, novaEquipe]);
      setNovaEquipeApoio({ nome: "", tipo: "🚓" });
      setEquipeApoioSelecionada(novaEquipe.id);
    }
  };

  const removerEquipeApoio = (id: string) => {
    setApoio(apoio.filter((e) => e.id !== id));
    if (equipeApoioSelecionada === id) {
      setEquipeApoioSelecionada(null);
    }
  };

  const isEquipeComNome = (tipo: string) => {
    return tipo !== "👁️" && tipo !== "🕵️";
  };

  const gerarRelease = () => {
    let release = `🔺 1ª RPM 🔺\n`;
    release += `1° BATALHÃO PM\n`;
    release += `*${cia.toUpperCase()}*\n\n`;

    if (naturezas.length > 0) {
      naturezas.forEach((nat) => {
        release += `${formatConfig.emojiNatureza} *${nat.toUpperCase()}*\n`;
      });
      release += "\n";
    }

    if (local) release += `${formatConfig.emojiLocal} *${local.toUpperCase()}*\n`;
    if (reds) release += `${formatConfig.emojiReds} *REDS: ${reds.toUpperCase()}*\n`;
    if (hora) release += `${formatConfig.emojiHora} *${hora.toUpperCase()}*\n`;
    
    // Pula linha antes da equipe principal
    if (equipeNome || isEquipeComNome(equipeType) || !isEquipeComNome(equipeType)) {
      release += "\n";
    }

    if (equipeNome || isEquipeComNome(equipeType)) {
      release += `${equipeType} *${equipeNome.toUpperCase()}*\n`;
    } else if (!isEquipeComNome(equipeType)) {
      release += `${equipeType}\n`;
    }

    if (guarnicao.length > 0) {
      guarnicao.forEach((p) => {
        release += `${formatConfig.emojiPolicial} ${p.patente} ${p.nome.toUpperCase()}\n`;
      });
    }

    if (apoio.length > 0) {
      release += "\n";
      apoio.forEach((e, index) => {
        // Gera nome da equipe apenas se não for Olho Vivo ou P2
        if (isEquipeComNome(e.tipo)) {
          release += `${e.tipo} *${e.nome.toUpperCase()}*\n`;
        } else {
          release += `${e.tipo}\n`;
        }
        e.policiais.forEach((p) => {
          release += `${formatConfig.emojiPolicial} ${p.patente} ${p.nome.toUpperCase()}\n`;
        });
        // Pula linha entre apoios (mas não após o último)
        if (index < apoio.length - 1) {
          release += "\n";
        }
      });
    }

    if (materialApreendido) {
      release += `\n${formatConfig.emojiMaterial} *MATERIAL APREENDIDO:*\n${materialApreendido.toUpperCase()}\n`;
    }

    if (autores) {
      release += `\n${formatConfig.emojiAutor} *AUTOR(ES) PRESO(S):*\n*${autores.toUpperCase()}*\n`;
    }

    if (historico) {
      release += `\n${formatConfig.emojiHistorico} *HISTÓRICO:*\n${historico.toUpperCase()}\n`;
    }

    release += `\n🔺 ${cia.toUpperCase()} - AQUI SE FORJAM HERÓIS BELORIZONTINOS!!!🔺\n`;
    release += `🔺 135 ANOS DO 1º BATALHÃO: PASSADO QUE INSPIRA, PRESENTE QUE PROTEGE.🔺`;

    return release;
  };

  const copiarRelease = () => {
    const release = gerarRelease();
    navigator.clipboard.writeText(release);
    toast.success("Release copiado para a área de transferência!");
  };

  const downloadRelease = () => {
    const release = gerarRelease();
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(release));
    element.setAttribute("download", `release-${new Date().toISOString().slice(0, 10)}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Release baixado!");
  };

  const release = gerarRelease();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-black to-amber-900 border-b-4 border-amber-600 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🛡️</div>
              <div>
                <h1 className="text-3xl font-bold text-amber-400">GERADOR DE RELEASE PM</h1>
                <p className="text-amber-200 text-sm">PMMG - Polícia Militar de Minas Gerais</p>
              </div>
            </div>
            <div className="text-right text-amber-300">
              <div className="text-sm font-bold">1ª RPM</div>
              <div className="text-xs">1º BATALHÃO PM</div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* CIA Selection */}
            <Card className="bg-gray-900 border-amber-600 border-2 p-6">
              <h3 className="text-lg font-bold text-amber-400 mb-4">CIA PMMG</h3>
              <Select value={cia} onValueChange={setCia}>
                <SelectTrigger className="bg-black border-amber-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-amber-600">
                  <SelectItem value="3ª CIA PMMG">3ª CIA PMMG</SelectItem>
                  <SelectItem value="4ª CIA PMMG">4ª CIA PMMG</SelectItem>
                  <SelectItem value="5ª CIA PMMG">5ª CIA PMMG</SelectItem>
                  <SelectItem value="6ª CIA PMMG">6ª CIA PMMG</SelectItem>
                  <SelectItem value="CIA TM PMMG">CIA TM PMMG</SelectItem>
                </SelectContent>
              </Select>
            </Card>

            {/* Natureza */}
            <Card className="bg-gray-900 border-amber-600 border-2 p-6">
              <h3 className="text-lg font-bold text-amber-400 mb-4">⚖️ NATUREZA DA OCORRÊNCIA</h3>
              <div className="space-y-3">
                {naturezas.map((nat, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-black p-3 rounded border border-amber-600">
                    <span className="text-white">{nat}</span>
                    <button onClick={() => removerNatureza(idx)} className="text-red-500 hover:text-red-400">
                      <X size={18} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={novanatureza}
                    onChange={(e) => setNovanatureza(e.target.value)}
                    placeholder="Ex: Furto, Roubo, Tráfico..."
                    className="bg-black border-amber-600 text-white"
                    onKeyPress={(e) => e.key === "Enter" && adicionarNatureza()}
                  />
                  <Button onClick={adicionarNatureza} className="bg-amber-600 hover:bg-amber-700 text-black font-bold">
                    <Plus size={18} />
                  </Button>
                </div>
              </div>
            </Card>

            {/* Informações Básicas */}
            <Card className="bg-gray-900 border-amber-600 border-2 p-6">
              <h3 className="text-lg font-bold text-amber-400 mb-4">📋 INFORMAÇÕES BÁSICAS</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-amber-300 text-sm font-semibold mb-2">📍 Local</label>
                  <Input
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    placeholder="Endereço completo"
                    className="bg-black border-amber-600 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-amber-300 text-sm font-semibold mb-2">⏰ Hora</label>
                    <Input
                      type="time"
                      value={hora}
                      onChange={(e) => setHora(e.target.value)}
                      className="bg-black border-amber-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-amber-300 text-sm font-semibold mb-2">📋 REDS</label>
                    <Input
                      value={reds}
                      onChange={(e) => setReds(e.target.value)}
                      placeholder="Número do REDS"
                      className="bg-black border-amber-600 text-white"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Equipe Principal */}
            <Card className="bg-gray-900 border-amber-600 border-2 p-6">
              <h3 className="text-lg font-bold text-amber-400 mb-4">🚓 EQUIPE PRINCIPAL</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Select value={equipeType} onValueChange={setEquipeType}>
                    <SelectTrigger className="bg-black border-amber-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-amber-600">
                      <SelectItem value="🚓">🚓 Viatura</SelectItem>
                      <SelectItem value="🏍️">🏍️ Moto</SelectItem>
                      <SelectItem value="👁️">👁️ Olho Vivo</SelectItem>
                      <SelectItem value="🚶">🚶 Patrulha</SelectItem>
                      <SelectItem value="🕵️">🕵️ P2</SelectItem>
                    </SelectContent>
                  </Select>
                  {isEquipeComNome(equipeType) && (
                    <Input
                      value={equipeNome}
                      onChange={(e) => setEquipeNome(e.target.value)}
                      placeholder="Nome/VP"
                      className="bg-black border-amber-600 text-white"
                    />
                  )}
                </div>
              </div>
            </Card>

            {/* Guarnição */}
            <Card className="bg-gray-900 border-amber-600 border-2 p-6">
              <h3 className="text-lg font-bold text-amber-400 mb-4">👮🏻‍♂️ GUARNIÇÃO</h3>
              <div className="space-y-3">
                {guarnicao.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-black p-3 rounded border border-amber-600">
                    <span className="text-white">{p.patente} {p.nome}</span>
                    <button onClick={() => removerPolicial(p.id)} className="text-red-500 hover:text-red-400">
                      <X size={18} />
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2">
                  <Select value={novoPolicial.patente} onValueChange={(val) => setNovoPolicial({ ...novoPolicial, patente: val })}>
                    <SelectTrigger className="bg-black border-amber-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-amber-600">
                      <SelectItem value="SD">SD</SelectItem>
                      <SelectItem value="CB">CB</SelectItem>
                      <SelectItem value="SGT">SGT</SelectItem>
                      <SelectItem value="TEN">TEN</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={novoPolicial.nome}
                    onChange={(e) => setNovoPolicial({ ...novoPolicial, nome: e.target.value })}
                    placeholder="Nome do policial"
                    className="col-span-2 bg-black border-amber-600 text-white"
                    onKeyPress={(e) => e.key === "Enter" && adicionarPolicial("guarnicao")}
                  />
                  <Button onClick={() => adicionarPolicial("guarnicao")} className="col-span-3 bg-amber-600 hover:bg-amber-700 text-black font-bold">
                    <Plus size={18} /> Adicionar
                  </Button>
                </div>
              </div>
            </Card>

            {/* Apoio */}
            <Card className="bg-gray-900 border-amber-600 border-2 p-6">
              <h3 className="text-lg font-bold text-amber-400 mb-4">🤝 APOIO</h3>
              <div className="space-y-4">
                {/* Adicionar Nova Equipe de Apoio */}
                <div className="space-y-2 pb-4 border-b border-amber-600">
                  <label className="block text-amber-300 text-sm font-semibold">Adicionar Equipe</label>
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={novaEquipeApoio.tipo} onValueChange={(val) => setNovaEquipeApoio({ ...novaEquipeApoio, tipo: val })}>
                      <SelectTrigger className="bg-black border-amber-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-amber-600">
                      <SelectItem value="🚓">🚓 Viatura</SelectItem>
                      <SelectItem value="🏍️">🏍️ Moto</SelectItem>
                      <SelectItem value="👁️">👁️ Olho Vivo</SelectItem>
                      <SelectItem value="🚶">🚶 Patrulha</SelectItem>
                      <SelectItem value="🕵️">🕵️ P2</SelectItem>
                    </SelectContent>
                  </Select>
                  {isEquipeComNome(novaEquipeApoio.tipo) && (
                      <Input
                        value={novaEquipeApoio.nome}
                        onChange={(e) => setNovaEquipeApoio({ ...novaEquipeApoio, nome: e.target.value })}
                        placeholder="Nome/VP"
                        className="col-span-2 bg-black border-amber-600 text-white"
                        onKeyPress={(e) => e.key === "Enter" && adicionarEquipeApoio()}
                      />
                    )}
                    <Button onClick={adicionarEquipeApoio} className="col-span-3 bg-amber-600 hover:bg-amber-700 text-black font-bold">
                      <Plus size={18} /> Adicionar Equipe
                    </Button>
                  </div>
                </div>

                {/* Equipes de Apoio e seus Policiais */}
                {apoio.map((equipe) => (
                  <div key={equipe.id} className="bg-black p-4 rounded border border-amber-600 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-amber-300">
                        {equipe.tipo} {equipe.nome}
                      </div>
                      <button onClick={() => removerEquipeApoio(equipe.id)} className="text-red-500 hover:text-red-400">
                        <X size={18} />
                      </button>
                    </div>

                    {/* Policiais da Equipe */}
                    <div className="space-y-2 pl-4 border-l-2 border-amber-600">
                      {equipe.policiais.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">{p.patente} {p.nome}</span>
                          <button onClick={() => removerPoliciaiApoio(equipe.id, p.id)} className="text-red-500 hover:text-red-400">
                            <X size={16} />
                          </button>
                        </div>
                      ))}

                      {/* Adicionar Policial à Equipe */}
                      {equipeApoioSelecionada === equipe.id && (
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <Select value={novoPoliciaiApoio.patente} onValueChange={(val) => setNovoPoliciaiApoio({ ...novoPoliciaiApoio, patente: val })}>
                            <SelectTrigger className="bg-gray-800 border-amber-600 text-white text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-amber-600">
                              <SelectItem value="SD">SD</SelectItem>
                              <SelectItem value="CB">CB</SelectItem>
                              <SelectItem value="SGT">SGT</SelectItem>
                              <SelectItem value="TEN">TEN</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={novoPoliciaiApoio.nome}
                            onChange={(e) => setNovoPoliciaiApoio({ ...novoPoliciaiApoio, nome: e.target.value })}
                            placeholder="Nome"
                            className="col-span-2 bg-gray-800 border-amber-600 text-white text-xs"
                            onKeyPress={(e) => e.key === "Enter" && adicionarPolicial("apoio")}
                          />
                          <Button onClick={() => adicionarPolicial("apoio")} className="col-span-3 bg-amber-600 hover:bg-amber-700 text-black font-bold text-xs py-1">
                            <Plus size={14} /> Adicionar
                          </Button>
                        </div>
                      )}

                      {equipeApoioSelecionada !== equipe.id && (
                        <Button
                          onClick={() => setEquipeApoioSelecionada(equipe.id)}
                          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold text-xs py-1 mt-2"
                        >
                          <Plus size={14} /> Adicionar Policial
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Material e Autores */}
            <Card className="bg-gray-900 border-amber-600 border-2 p-6">
              <h3 className="text-lg font-bold text-amber-400 mb-4">📦 MATERIAL E AUTORES</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-amber-300 text-sm font-semibold mb-2">📦 Material Apreendido</label>
                  <Textarea
                    value={materialApreendido}
                    onChange={(e) => setMaterialApreendido(e.target.value)}
                    placeholder="Descreva o material apreendido"
                    className="bg-black border-amber-600 text-white"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-amber-300 text-sm font-semibold mb-2">🔗 Autor(es) Preso(s)</label>
                  <Textarea
                    value={autores}
                    onChange={(e) => setAutores(e.target.value)}
                    placeholder="Nome e dados dos autores"
                    className="bg-black border-amber-600 text-white"
                    rows={3}
                  />
                </div>
              </div>
            </Card>

            {/* Histórico */}
            <Card className="bg-gray-900 border-amber-600 border-2 p-6">
              <h3 className="text-lg font-bold text-amber-400 mb-4">📜 HISTÓRICO</h3>
              <Textarea
                value={historico}
                onChange={(e) => setHistorico(e.target.value)}
                placeholder="Descreva os detalhes da ocorrência"
                className="bg-black border-amber-600 text-white"
                rows={6}
              />
            </Card>
          </div>

          {/* Preview Section */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {/* Formatação Customizável */}
              <Card className="bg-gray-900 border-amber-600 border-2 p-4">
                <button
                  onClick={() => setShowFormatConfig(!showFormatConfig)}
                  className="w-full flex items-center justify-between text-amber-400 font-bold hover:text-amber-300"
                >
                  <div className="flex items-center gap-2">
                    <Palette size={18} />
                    Formatação
                  </div>
                  <span>{showFormatConfig ? "−" : "+"}</span>
                </button>

                {showFormatConfig && (
                  <div className="mt-4 space-y-3 pt-4 border-t border-amber-600">
                    <div>
                      <label className="block text-amber-300 text-xs font-semibold mb-2">Emoji Natureza</label>
                      <div className="flex gap-2">
                        {EMOJI_OPTIONS.natureza.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => setFormatConfig({ ...formatConfig, emojiNatureza: emoji })}
                            className={`text-xl p-2 rounded border-2 ${
                              formatConfig.emojiNatureza === emoji ? "border-amber-400 bg-amber-900" : "border-amber-600"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-amber-300 text-xs font-semibold mb-2">Emoji Local</label>
                      <div className="flex gap-2">
                        {EMOJI_OPTIONS.local.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => setFormatConfig({ ...formatConfig, emojiLocal: emoji })}
                            className={`text-xl p-2 rounded border-2 ${
                              formatConfig.emojiLocal === emoji ? "border-amber-400 bg-amber-900" : "border-amber-600"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-amber-300 text-xs font-semibold mb-2">Emoji Policial</label>
                      <div className="flex gap-2">
                        {EMOJI_OPTIONS.policial.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => setFormatConfig({ ...formatConfig, emojiPolicial: emoji })}
                            className={`text-xl p-2 rounded border-2 ${
                              formatConfig.emojiPolicial === emoji ? "border-amber-400 bg-amber-900" : "border-amber-600"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Preview */}
              <Card className="bg-gray-900 border-amber-600 border-2 p-6">
                <h3 className="text-lg font-bold text-amber-400 mb-4">📱 PREVIEW</h3>
                <div className="bg-black p-4 rounded border border-amber-600 mb-4 max-h-96 overflow-y-auto">
                  <pre className="text-xs text-amber-100 whitespace-pre-wrap font-mono">{release}</pre>
                </div>
                <div className="space-y-3">
                  <Button onClick={copiarRelease} className="w-full bg-amber-600 hover:bg-amber-700 text-black font-bold">
                    <Copy size={18} /> Copiar para WhatsApp
                  </Button>
                  <Button onClick={downloadRelease} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold">
                    <Download size={18} /> Baixar TXT
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
