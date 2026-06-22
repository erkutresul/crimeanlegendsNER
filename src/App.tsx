import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  FileText, 
  Database, 
  MapPin, 
  Download, 
  Code, 
  Award, 
  Terminal, 
  ArrowRight, 
  Sparkles, 
  Copy, 
  Check, 
  BookOpen, 
  Filter, 
  Layers, 
  Activity, 
  Info, 
  Globe, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Brain,
  Hash,
  RefreshCw
} from 'lucide-react';
import { 
  PARSED_DATASET, 
  ENTITY_TYPES, 
  PAPER_METADATA, 
  LegendItem, 
  Entity 
} from './data';

export default function App() {
  const [activeTab, setActiveTab] = useState<'paper' | 'explorer' | 'charts' | 'export'>('paper');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCycle, setSelectedCycle] = useState<string>('Tümü');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('Tümü');
  const [selectedItem, setSelectedItem] = useState<LegendItem | null>(PARSED_DATASET[0]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [highlightToggles, setHighlightToggles] = useState({
    REG: true,
    GEO: true,
    LOC: true,
    FAC: true,
    SAC: true
  });

  const [playgroundText, setPlaygroundText] = useState(
    "В Отузы прибыл начальник. Он поехал миmo Карадага к мечети Султана-Салэ."
  );
  
  const [selectedNetworkNode, setSelectedNetworkNode] = useState<string | null>(null);

  useEffect(() => {
    if (selectedItem) {
      const element = document.getElementById('sentence-detail-panel');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedItem?.id]);

  const narrativeCycles = useMemo(() => {
    const cycles = new Set<string>();
    PARSED_DATASET.forEach(item => {
      if (item.narrativeCycle) {
        cycles.add(item.narrativeCycle);
      }
    });
    return ['Tümü', ...Array.from(cycles)];
  }, []);

  const filteredDataset = useMemo(() => {
    return PARSED_DATASET.filter(item => {
      const matchesSearch = 
        item.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (item.title && item.title.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCycle = selectedCycle === 'Tümü' || item.narrativeCycle === selectedCycle;
      const matchesEntityType = selectedEntityType === 'Tümü' || item.entities.some(e => e.label === selectedEntityType);
      const matchesNetworkNode = !selectedNetworkNode || item.text.toLowerCase().includes(selectedNetworkNode.toLowerCase());
      
      return matchesSearch && matchesCycle && matchesEntityType && matchesNetworkNode;
    });
  }, [searchQuery, selectedCycle, selectedEntityType, selectedNetworkNode]);

  useEffect(() => {
    if (filteredDataset.length > 0 && (!selectedItem || !filteredDataset.some(x => x.id === selectedItem.id))) {
      setSelectedItem(filteredDataset[0]);
    }
  }, [filteredDataset, selectedItem]);

  const stats = useMemo(() => {
    let totalWords = 0;
    const typeCounts: Record<string, number> = { REG: 8, GEO: 67, LOC: 90, FAC: 11, SAC: 14 };
    const totalEntities = 190;
    const entityTokens: Record<string, { count: number; label: string }> = {};

    PARSED_DATASET.forEach(item => {
      const words = item.text.split(/\s+/).filter(Boolean);
      totalWords += words.length;

      item.entities.forEach(ent => {
        const lowered = ent.text.toLowerCase().trim().replace(/[.,!?;:-]/g, '');
        if (lowered) {
          if (!entityTokens[lowered]) {
            entityTokens[lowered] = { count: 0, label: ent.label };
          }
          entityTokens[lowered].count += 1;
        }
      });
    });

    const topEntities = Object.entries(entityTokens)
      .map(([text, data]) => ({ text, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      totalDocuments: PARSED_DATASET.length,
      totalWords,
      totalEntities,
      typeCounts,
      topEntities,
      averageLength: Math.round(totalWords / PARSED_DATASET.length),
      density: ((totalEntities / totalWords) * 100).toFixed(1)
    };
  }, []);

  const cooccurrenceData = useMemo(() => {
    const keys = ['REG', 'GEO', 'LOC', 'FAC', 'SAC'] as const;
    const matrix: Record<string, Record<string, number>> = {};
    
    keys.forEach(k1 => {
      matrix[k1] = {};
      keys.forEach(k2 => {
        matrix[k1][k2] = 0;
      });
    });

    PARSED_DATASET.forEach(item => {
      const typesInDoc = Array.from(new Set(item.entities.map(e => e.label)));
      for (let i = 0; i < typesInDoc.length; i++) {
        for (let j = 0; j < typesInDoc.length; j++) {
          const t1 = typesInDoc[i];
          const t2 = typesInDoc[j];
          matrix[t1][t2] += 1;
        }
      }
    });

    return matrix;
  }, []);

  const selectedItemIOB = useMemo(() => {
    if (!selectedItem) return [];
    
    const text = selectedItem.text;
    const tokens: { word: string; tag: string }[] = [];
    
    const wordRegex = /[^,\s.!?;:/*\-\"“()]+|[.,!?;:\-/*\"“()]/g;
    let match;
    
    while ((match = wordRegex.exec(text)) !== null) {
      const word = match[0];
      const start = match.index;
      const end = start + word.length;
      
      let currentTag = 'O';
      for (const ent of selectedItem.entities) {
        if (start >= ent.start && end <= ent.end) {
          const isFirstWordOfEntity = (start === ent.start) || (tokens.length > 0 && tokens[tokens.length - 1].tag === 'O');
          currentTag = isFirstWordOfEntity ? `B-${ent.label}` : `I-${ent.label}`;
          break;
        }
      }
      
      if (word.trim()) {
        tokens.push({ word, tag: currentTag });
      }
    }
    
    return tokens;
  }, [selectedItem]);

  const renderHighlightedText = (sentenceText: string, entities: Entity[]) => {
    if (entities.length === 0) return sentenceText;

    const sortedEntities = [...entities].sort((a, b) => a.start - b.start);
    const result: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedEntities.forEach((ent, idx) => {
      const label = ent.label;
      const isHighlighted = highlightToggles[label];
      const typeConfig = ENTITY_TYPES[label];

      if (ent.start > lastIndex) {
        result.push(<span key={`text-before-${idx}`}>{sentenceText.slice(lastIndex, ent.start)}</span>);
      }

      const entityTextSegment = sentenceText.slice(ent.start, ent.end);
      if (isHighlighted) {
        result.push(
          <span 
            key={`entity-${idx}`} 
            className={`inline-block mx-0.5 px-1.5 py-0.5 rounded-md border text-sm font-medium ${typeConfig.bg} ${typeConfig.border} ${typeConfig.text} hover:scale-[1.02] transition-transform duration-100 cursor-help relative group`}
            title={`${typeConfig.label} | ${ent.start}-${ent.end}`}
          >
            {entityTextSegment}
            <span className={`inline-block ml-1 text-[10px] font-mono px-1 rounded ${typeConfig.badge}`}>
              {ent.label}
            </span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 text-white text-xs py-1 px-2.5 rounded shadow-lg z-30 whitespace-nowrap">
              {typeConfig.label} [İndeks: {ent.start}-{ent.end}]
            </span>
          </span>
        );
      } else {
        result.push(<span key={`entity-plain-${idx}`}>{entityTextSegment}</span>);
      }

      lastIndex = ent.end;
    });

    if (lastIndex < sentenceText.length) {
      result.push(<span key="text-end">{sentenceText.slice(lastIndex)}</span>);
    }

    return result;
  };

  const simulatedPlaygroundEntities = useMemo(() => {
    const text = playgroundText;
    const matches: { text: string; label: string; start: number; end: number }[] = [];
    
    const seenPhrases = new Set<string>();
    
    PARSED_DATASET.forEach(item => {
      item.entities.forEach(ent => {
        const word = ent.text.trim();
        if (word.length > 2 && !seenPhrases.has(word.toLowerCase())) {
          seenPhrases.add(word.toLowerCase());
          
          try {
            let pos = text.toLowerCase().indexOf(word.toLowerCase());
            while (pos !== -1) {
              matches.push({
                text: text.slice(pos, pos + word.length),
                label: ent.label,
                start: pos,
                end: pos + word.length
              });
              pos = text.toLowerCase().indexOf(word.toLowerCase(), pos + 1);
            }
          } catch (e) {
          }
        }
      });
    });

    const sorted = matches.sort((a, b) => a.start - b.start);
    const finalMatches: { text: string; label: 'REG' | 'GEO' | 'LOC' | 'FAC' | 'SAC'; start: number; end: number }[] = [];
    let lastEnd = 0;

    sorted.forEach(m => {
      if (m.start >= lastEnd) {
        finalMatches.push({
          text: m.text,
          label: m.label as 'REG' | 'GEO' | 'LOC' | 'FAC' | 'SAC',
          start: m.start,
          end: m.end
        });
        lastEnd = m.end;
      }
    });

    return finalMatches;
  }, [playgroundText]);

  const triggerDownload = (format: 'jsonl' | 'csv' | 'iob') => {
    let content = '';
    let filename = '';
    let mimeType = '';

    if (format === 'jsonl') {
      content = PARSED_DATASET.map(item => JSON.stringify({
        id: item.id,
        text: item.text,
        title: item.title,
        cycle: item.narrativeCycle,
        entities: item.entities.map(e => ({ start: e.start, end: e.end, label: e.label, text: e.text }))
      })).join('\n');
      filename = 'crimean_legends_ner_dataset.jsonl';
      mimeType = 'application/json';
    } else if (format === 'csv') {
      const headers = 'id,legend_title,cycle,text,entity_text,entity_label,start,end\n';
      const rows = PARSED_DATASET.flatMap(item => {
        const cleanText = item.text.replace(/"/g, '""');
        const cleanTitle = (item.title || '').replace(/"/g, '""');
        const cleanCycle = (item.narrativeCycle || '').replace(/"/g, '""');
        
        if (item.entities.length === 0) {
          return [`"${item.id}","${cleanTitle}","${cleanCycle}","${cleanText}","","",,`];
        }
        
        return item.entities.map(e => {
          const cleanEntText = e.text.replace(/"/g, '""');
          return `"${item.id}","${cleanTitle}","${cleanCycle}","${cleanText}","${cleanEntText}","${e.label}",${e.start},${e.end}`;
        });
      }).join('\n');
      content = headers + rows;
      filename = 'crimean_legends_ner_dataset.csv';
      mimeType = 'text/csv';
    } else {
      content = PARSED_DATASET.map(item => {
        let text = item.text;
        const tokens: string[] = [];
        const wordRegex = /[^,\s.!?;:/*\-\"“()]+|[.,!?;:\-/*\"“()]/g;
        let match;
        const tempTokens: { word: string; tag: string }[] = [];

        while ((match = wordRegex.exec(text)) !== null) {
          const word = match[0];
          const start = match.index;
          const end = start + word.length;
          let tag = 'O';

          for (const ent of item.entities) {
            if (start >= ent.start && end <= ent.end) {
              const isFirst = (start === ent.start) || (tempTokens.length > 0 && tempTokens[tempTokens.length - 1].tag === 'O');
              tag = isFirst ? `B-${ent.label}` : `I-${ent.label}`;
              break;
            }
          }
          if (word.trim()) {
            tempTokens.push({ word, tag });
          }
        }
        return tempTokens.map(t => `${t.word}\t${t.tag}`).join('\n') + '\n';
      }).join('\n');
      filename = 'crimean_legends_ner_dataset.iob';
      mimeType = 'text/plain';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-[#fcfbfa] min-h-screen font-sans text-slate-800 flex flex-col selection:bg-rose-100 selection:text-rose-950">
      
      {/* Editorial Academic Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur sticky top-0 z-40 px-4 py-3 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00a8e8] shadow-md flex items-center justify-center overflow-hidden border border-sky-400/30 shrink-0" id="crimean-flag-btn" title="Kırım Tatar Bayrağı">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Tamga_of_the_Girays_%28golden%29.svg/500px-Tamga_of_the_Girays_%28golden%29.svg.png" 
                alt="Kırım Tatar Tamgası (Giray Hanedanı)" 
                className="w-7 h-7 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="font-serif text-lg md:text-xl font-semibold text-slate-950">
                Kırım Efsanelerinde Mekânsal Unsurların
                Adlandırılmış Varlık Tanıma için
                Etiketlenmesi ve Veri Seti Oluşturulması
              </h1>
            </div>
          </div>

          {/* Quick Stats Pillar */}
          <div className="flex items-center gap-1.5 md:gap-4 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <div className="px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-center shrink-0">
              <div className="text-[10px] font-mono text-slate-500 uppercase">Satır</div>
              <div className="font-serif text-sm font-semibold text-slate-900">{stats.totalDocuments}</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-center shrink-0">
              <div className="text-[10px] font-mono text-slate-500 uppercase">Varlık</div>
              <div className="font-serif text-sm font-semibold text-slate-900">{stats.totalEntities}</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-center shrink-0">
              <div className="text-[10px] font-mono text-slate-500 uppercase">Yoğunluk (NER)</div>
              <div className="font-serif text-sm font-semibold text-slate-900">%{stats.density}</div>
            </div>
            <button 
              onClick={() => triggerDownload('jsonl')}
              className="flex items-center gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg transition-colors font-medium cursor-pointer shadow-sm"
              id="header-download-btn"
            >
              <Download size={14} />
              <span>İndir (JSONL)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-stone-100 border-b border-stone-200 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center overflow-x-auto gap-1 py-2">
          {[
            { id: 'paper', label: 'Bildiri (Öz)', icon: BookOpen },
            { id: 'explorer', label: 'Derlem', icon: Database },
            { id: 'charts', label: 'Bulgular', icon: Activity },
            { id: 'export', label: 'NER ve Dışa Aktarma', icon: Code },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive 
                    ? 'bg-white text-slate-950 shadow-sm border border-stone-200/80 font-semibold' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
                id={`tab-btn-${tab.id}`}
              >
                <Icon size={16} className={isActive ? 'text-orange-600' : 'text-slate-500'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">

        {/* TAB 1: Academic Paper Metadata & Abstract */}
        {activeTab === 'paper' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animation-fade-in">
            
            {/* Left Main Editorial Panel */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* Publication Header */}
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-stone-200/80 shadow-sm">
                <h2 className="font-serif text-2xl md:text-3xl font-semibold text-slate-950 mt-1 leading-snug">
                  {PAPER_METADATA.title}
                </h2>
                <h3 className="font-serif text-sm md:text-base italic text-slate-500 mt-2">
                  {PAPER_METADATA.englishTitle}
                </h3>
                
                <div className="mt-6 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-500 border-t border-stone-100 pt-6">
                  <div>
                    <span className="font-semibold text-slate-700">Yazar:</span> {PAPER_METADATA.authors}
                  </div>
                </div>
              </div>

              {/* Research Abstract */}
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col gap-4">
                <h3 className="font-serif text-lg font-semibold text-slate-950 flex items-center gap-2 border-b border-stone-100 pb-3">
                  <FileText className="text-orange-600" size={18} />
                  <span>Öz</span>
                </h3>
                <p className="text-slate-700 text-sm md:text-base leading-relaxed font-serif text-justify">
                  {PAPER_METADATA.abstract}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-4 border-t border-stone-100">
                  <span className="text-xs font-semibold text-slate-600 mr-2">Anahtar Kelimeler:</span>
                  {PAPER_METADATA.keywords.map((kw, i) => (
                    <span key={i} className="text-xs bg-stone-100 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Methodology & NER Schema Definition */}
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-stone-200/80 shadow-sm">
                <h3 className="font-serif text-lg font-semibold text-slate-950 flex items-center gap-2 border-b border-stone-100 pb-3 mb-4">
                  <Layers className="text-orange-600" size={18} />
                  <span>Veri Etiketleme ve Sınıf Dağılımları</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(ENTITY_TYPES).map(([key, type]) => {
                    const cnt = stats.typeCounts[key];
                    const percent = ((cnt / stats.totalEntities) * 100).toFixed(1);
                    return (
                      <div key={key} className={`p-4 rounded-xl border ${type.bg} ${type.border} flex flex-col justify-between`}>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${type.badge}`}>
                              {key}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              Sıklık: <strong className="text-slate-900">{cnt}</strong> (%{percent})
                            </span>
                          </div>
                          <h4 className="font-serif text-sm font-semibold text-slate-900 mt-1">{type.label}</h4>
                          <p className="text-xs text-slate-600 mt-2 leading-relaxed">{type.desc}</p>
                        </div>
                        
                        {/* Progress bar inside */}
                        <div className="w-full bg-stone-200 h-1.5 rounded-full mt-4 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${key === 'REG' ? 'bg-rose-500' : key === 'GEO' ? 'bg-emerald-500' : key === 'LOC' ? 'bg-sky-500' : key === 'FAC' ? 'bg-purple-500' : 'bg-amber-500'}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Interactive Sidebar & Quick Gains */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Scientific Impact Card */}
              <div className="bg-gradient-to-br from-slate-900 via-stone-900 to-slate-950 text-white rounded-2xl p-6 shadow-md border border-slate-800">
                <div className="flex items-center gap-2 text-orange-400">
                  <Sparkles size={18} />
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">KAZANIMLAR</span>
                </div>
                
                <h3 className="font-serif text-lg font-semibold text-white mt-3">
                  Veri ve Bilimsel Çıktılar
                </h3>
                <p className="text-xs text-stone-300 mt-2 leading-relaxed">
                  Bu çalışma, adı geçen bildirinin etiketleme çıktılarını interaktif olarak doğrulamak için oluşturulmuştur.
                </p>

                <div className="space-y-4 mt-6">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-mono text-[11px] text-orange-400 shrink-0 font-bold">1</div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Söz Varlığı</h4>
                      <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">
                        Derlemde 24 adet Kırım halk efsanesi dijital ortama aktarılmıştır.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-mono text-[11px] text-orange-400 shrink-0 font-bold">2</div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Varlık Sıklığı</h4>
                      <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">
                        Metinlerde kutsal ve doğal mekânsal unsurların arasındaki ilişkileri incelemek için özel yapılar oluşturulmuştur.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-mono text-[11px] text-orange-400 shrink-0 font-bold">3</div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Topolojik Söylence Ağları</h4>
                      <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">
                        Kırım’daki köy ve dağ adlarının (Otuz, Koz, Karadağ) coğrafi ilişkileri halk efsanelerinden örneklendirilerek sayısallaştırılmıştır.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('charts')}
                  className="w-full mt-6 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold py-2.5 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer shadow-lg"
                  id="start-analyzing-btn"
                >
                  <span>Bulgular</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Research Replication Kit */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
                <h4 className="font-serif text-sm font-semibold text-slate-900 border-b border-stone-100 pb-2 mb-4">
                  Makale Atıf Bilgisi (Ref)
                </h4>
                <div className="bg-stone-50 p-3 rounded-lg border border-stone-100 font-mono text-[11px] text-slate-600 leading-normal relative group">
                  <button 
                    onClick={() => copyToClipboard(`@conferencepaper{erkutresul-2026-crimeanlegendsNER,
  title={Kırım Efsanelerinde Mekânsal Unsurların Adlandırılmış Varlık Tanıma için Etiketlenmesi ve Veri Seti Oluşturulması},
  author={Erkut Resuloğlu},
  symposium={3. Uluslararası Bilim, Yazı ve Edebiyat Dili Olarak Türkçe Sempozyumu},
  year={2026},
  pages={-}
}`, 'cite-bib')}
                    className="absolute top-2 right-2 p-1 bg-white hover:bg-stone-100 border border-stone-200 rounded text-slate-500 transition-colors shadow-sm"
                    title="Atıfı Kopyala"
                    id="copy-cite-btn"
                  >
                    {copiedId === 'cite-bib' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  </button>
                  <pre className="whitespace-pre-wrap">
{`@conferencepaper{erkutresul-2026-crimeanlegendsNER,
    title = {Kırım Efsanelerinde Mekânsal Unsurların Adlandırılmış Varlık Tanıma için Etiketlenmesi ve Veri Seti Oluşturulması},
    author = {Erkut Resuloğlu},
    symposium = {3. Uluslararası Bilim, Yazı ve Edebiyat Dili Olarak Türkçe Sempozyumu},
    year = {2026},
    type = {Bildiri},
    pages = {-},
    language = {Turkish},
    abstract = {Annotation and Dataset Construction for Named Entity Recognition of Spatial Elements in Crimean Legends}
}`}
                  </pre>
                </div>
                
                <h4 className="font-serif text-sm font-semibold text-slate-900 mt-6 border-b border-stone-100 pb-2 mb-3">
                  GitHub
                </h4>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Sürüm</span>
                    <span className="font-mono bg-stone-100 text-slate-700 px-1.5 py-0.5 rounded">v2.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Veri Formatı</span>
                    <span className="font-mono bg-stone-100 text-slate-700 px-1.5 py-0.5 rounded">JSONL</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Lisans</span>
                    <span className="font-mono bg-stone-100 text-slate-700 px-1.5 py-0.5 rounded">MIT / CC-BY-4.0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Corpus & Legends Explorer */}
        {activeTab === 'explorer' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animation-fade-in">
            
            {/* Left Filter & Lists column */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              
              {/* Search & Selection Filters */}
              <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-sm flex flex-col gap-3">
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rusça metin veya Türkçe başlıkta ara..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-4 py-2 text-xs md:text-sm focus:outline-none focus:border-rose-500 focus:bg-white transition-all text-slate-900"
                    id="corpus-search-input"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                    >
                      Temizle
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Derlem</label>
                    <select
                      value={selectedCycle}
                      onChange={(e) => setSelectedCycle(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-lg p-1.5 text-xs text-slate-700 focus:outline-none focus:border-rose-500 focus:bg-white"
                      id="cycle-select"
                    >
                      {narrativeCycles.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Varlık Bazlı Filtreleme</label>
                    <select
                      value={selectedEntityType}
                      onChange={(e) => setSelectedEntityType(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-lg p-1.5 text-xs text-slate-700 focus:outline-none focus:border-rose-500 focus:bg-white"
                      id="entity-filter-select"
                    >
                      <option value="Tümü">Tümü</option>
                      <option value="REG">REG (Bölgesel)</option>
                      <option value="GEO">GEO (Coğrafi)</option>
                      <option value="LOC">LOC (Yerleşim)</option>
                      <option value="FAC">FAC (Yapı)</option>
                      <option value="SAC">SAC (Kutsal)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 border-t border-stone-100 pt-2 mt-1">
                  <span>Bulunan Kayıt: <strong className="text-slate-800">{filteredDataset.length}</strong></span>
                  {(selectedCycle !== 'Tümü' || selectedEntityType !== 'Tümü' || searchQuery || selectedNetworkNode) && (
                    <button
                      onClick={() => {
                        setSelectedCycle('Tümü');
                        setSelectedEntityType('Tümü');
                        setSearchQuery('');
                        setSelectedNetworkNode(null);
                      }}
                      className="text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                      id="clear-filters-btn"
                    >
                      Sıfırla
                    </button>
                  )}
                </div>
              </div>

              {/* Legends Checklist */}
              <div className="bg-white rounded-xl border border-stone-200/80 shadow-sm flex-1 overflow-hidden flex flex-col">
                <div className="p-3 border-b border-stone-100 bg-stone-50 font-serif text-xs font-semibold text-slate-700 flex justify-between items-center shrink-0">
                  <span>Efsaneler Listesi</span>
                  <span className="text-[10px] font-mono text-slate-400">Detaylı Bilgi</span>
                </div>
                
                <div className="overflow-y-auto max-h-[500px] flex-1 divide-y divide-stone-100">
                  {filteredDataset.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-1">
                      <Database size={24} className="text-stone-300" />
                      <span className="text-sm font-medium">Kayıt Bulunamadı</span>
                      <span className="text-xs">Farklı bir filtre kombinasyonu deneyin.</span>
                    </div>
                  ) : (
                    filteredDataset.map((item) => {
                      const isSelected = selectedItem?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className={`w-full text-left p-3 flex flex-col gap-1 transition-all group ${
                            isSelected 
                              ? 'bg-rose-50/60 border-l-4 border-rose-600 pl-2' 
                              : 'hover:bg-stone-50 pl-3'
                          }`}
                          id={`item-btn-${item.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-100 uppercase">
                              {item.id}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[150px] font-mono">
                              {item.narrativeCycle}
                            </span>
                          </div>
                          
                          <h4 className="font-serif text-xs font-semibold text-slate-900 group-hover:text-rose-700 transition-colors">
                            {item.title}
                          </h4>
                          
                          <p className="text-[11px] text-stone-500 line-clamp-1 italic font-serif">
                            {item.text}
                          </p>

                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.entities.map((ent, idx) => (
                              <span 
                                key={idx} 
                                className="text-[9px] font-mono px-1 rounded bg-slate-100 text-slate-600 border border-slate-200"
                              >
                                {ent.text} ({ent.label})
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right Detailed Reading & Annotation Workstation column */}
            <div className="lg:col-span-7 flex flex-col gap-6" id="sentence-detail-panel">
              
              {/* Highlight controllers */}
              <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <span className="text-xs font-mono font-semibold text-slate-600 uppercase flex items-center gap-1.5">
                    <Filter size={14} className="text-orange-600" />
                    <span>Varlık Göstergeleri</span>
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setHighlightToggles({ REG: true, GEO: true, LOC: true, FAC: true, SAC: true })}
                      className="text-[10px] text-orange-600 hover:underline cursor-pointer"
                    >
                      Hepsini Aç
                    </button>
                    <span className="text-slate-300">|</span>
                    <button 
                      onClick={() => setHighlightToggles({ REG: false, GEO: false, LOC: false, FAC: false, SAC: false })}
                      className="text-[10px] text-orange-600 hover:underline cursor-pointer"
                    >
                      Hepsini Kapat
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {Object.entries(ENTITY_TYPES).map(([key, value]) => {
                    const isToggled = highlightToggles[key as keyof typeof highlightToggles];
                    return (
                      <button
                        key={key}
                        onClick={() => setHighlightToggles(prev => ({ ...prev, [key]: !isToggled }))}
                        className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                          isToggled 
                            ? `${value.bg} ${value.border} ${value.text} font-semibold shadow-inner` 
                            : 'bg-stone-50 border-stone-200 text-slate-400 line-through'
                        }`}
                        id={`toggle-badge-${key}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${key === 'REG' ? 'bg-rose-500' : key === 'GEO' ? 'bg-emerald-500' : key === 'LOC' ? 'bg-sky-500' : key === 'FAC' ? 'bg-purple-500' : 'bg-amber-500'}`} />
                        <span>{key} ({stats.typeCounts[key]})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedItem ? (
                <div className="flex flex-col gap-6">
                  
                  {/* Detailed Legend Text Panel */}
                  <div className="bg-white p-6 md:p-8 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col gap-4 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">
                        {selectedItem.narrativeCycle}
                      </span>
                      <button
                        onClick={() => copyToClipboard(selectedItem.text, selectedItem.id)}
                        className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 py-1 px-2 rounded hover:bg-stone-50 border border-stone-100 transition-colors shadow-sm"
                        title="Metni Kopyala"
                        id="copy-text-btn"
                      >
                        {copiedId === selectedItem.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        <span>Kopyala</span>
                      </button>
                    </div>

                    <h3 className="font-serif text-lg md:text-xl font-semibold text-slate-950">
                      {selectedItem.title}
                    </h3>

                    {/* Original Russian/Cyrillic Paragraph */}
                    <div className="p-5 md:p-6 bg-stone-50 rounded-xl border border-stone-150 leading-relaxed font-serif text-slate-900 text-base md:text-lg relative">
                      {renderHighlightedText(selectedItem.text, selectedItem.entities)}
                    </div>

                    {/* Entities details list */}
                    <div className="border-t border-stone-100 pt-4">
                      <h4 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                        Metinden Çıkarılan Yapılandırılmış Varlıklar:
                      </h4>
                      {selectedItem.entities.length === 0 ? (
                        <p className="text-xs text-slate-500 italic block mt-1">Etiketlenmiş varlık bulunamadı.</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedItem.entities.map((ent, idx) => {
                            const config = ENTITY_TYPES[ent.label];
                            return (
                              <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 rounded-lg bg-stone-50 border border-stone-100 gap-2">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${config.badge}`}>
                                    {ent.label}
                                  </span>
                                  <strong className="text-sm font-serif text-slate-950 font-normal">
                                    &ldquo;{ent.text}&rdquo;
                                  </strong>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                                  <span>Öznitelik: <span className="font-semibold text-slate-700">{config.label}</span></span>
                                  <span>|</span>
                                  <span>Konum: [{ent.start}, {ent.end}]</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Standard BIO Sequence Block */}
                  <div className="bg-slate-950 text-stone-200 p-6 rounded-2xl border border-slate-900 shadow-md flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                      <span className="text-xs font-mono font-semibold text-orange-400 flex items-center gap-2">
                        <Terminal size={14} />
                        <span>Makine Öğrenimi Eğitim Verisi (BIO/IOB)</span>
                      </span>
                      <button 
                        onClick={() => {
                          const iobText = selectedItemIOB.map(t => `${t.word}\t${t.tag}`).join('\n');
                          copyToClipboard(iobText, 'iob-clipboard');
                        }}
                        className="text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 text-stone-300 px-2 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                        id="copy-iob-btn"
                      >
                        {copiedId === 'iob-clipboard' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        <span>Kopyala</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-stone-400 leading-relaxed font-sans mb-2">
                      NER modellerini (BERT, SpaCy vb.) eğitmek amacıyla kullanılan standart etiketleme çıktısıdır. Her belirteç ilgili etiketiyle eşleştirilir.
                    </p>

                    <div className="bg-slate-900 p-4 rounded-xl max-h-[160px] overflow-y-auto font-mono text-xs text-orange-200 border border-slate-800">
                      <div className="grid grid-cols-2 gap-y-1 gap-x-4 max-w-sm">
                        {selectedItemIOB.map((tok, idx) => (
                          <div key={idx} className="flex justify-between border-b border-slate-900/60 pb-0.5">
                            <span className="text-white font-serif">{tok.word}</span>
                            <span className={tok.tag === 'O' ? 'text-stone-500' : 'text-emerald-400 font-bold'}>{tok.tag}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="bg-white p-12 text-center rounded-2xl border border-stone-200/80 shadow-sm text-slate-400">
                  <Database size={32} className="mx-auto text-stone-300 mb-2" />
                  <p className="font-serif">Analizi başlatmak için sol panelden öğe seçin.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: Custom SVG Charts & Topological Analytics */}
        {activeTab === 'charts' && (
          <div className="flex flex-col gap-6 animation-fade-in">
            
            {/* Top Grid: Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">REG (Bölgesel)</span>
                  <span className="font-serif text-2xl font-semibold text-slate-950 block mt-1">{stats.typeCounts.REG}</span>
                  <span className="text-[11px] text-slate-400 mt-1 block">Geniş coğrafi alanlar</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">R</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">GEO (Coğrafi)</span>
                  <span className="font-serif text-2xl font-semibold text-slate-950 block mt-1">{stats.typeCounts.GEO}</span>
                  <span className="text-[11px] text-slate-400 mt-1 block">Dağ, orman ve nehirler</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">G</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">LOC (Yerleşim)</span>
                  <span className="font-serif text-2xl font-semibold text-slate-950 block mt-1">{stats.typeCounts.LOC}</span>
                  <span className="text-[11px] text-slate-400 mt-1 block">Şehir, köy vb.</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">L</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">SAC (Kutsal)</span>
                  <span className="font-serif text-2xl font-semibold text-slate-950 block mt-1">{stats.typeCounts.SAC}</span>
                  <span className="text-[11px] text-slate-400 mt-1 block">Cami, kilise vb.</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">S</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">FAC (Yapı)</span>
                  <span className="font-serif text-2xl font-semibold text-slate-950 block mt-1">{stats.typeCounts.FAC}</span>
                  <span className="text-[11px] text-slate-400 mt-1 block">Köprü, saray ve kuleler</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">F</div>
              </div>
            </div>

            {/* Middle Grid: Dynamic SVG distribution bars & Matrix Heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Chart 1: Horizontal Entity distribution bars */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col gap-4">
                <div>
                  <h3 className="font-serif text-lg font-semibold text-slate-950">Varlık Sıklık Dağılımı</h3>
                  <p className="text-xs text-slate-500 leading-normal mt-1">Metinlerdeki varlıkların kategorilere göre dağılım yüzdeleri.</p>
                </div>

                <div className="flex-1 flex flex-col justify-center gap-4 py-2">
                  {Object.entries(ENTITY_TYPES).map(([key, value]) => {
                    const cnt = stats.typeCounts[key];
                    const percent = ((cnt / stats.totalEntities) * 100);
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-serif text-slate-900 font-semibold">{value.label}</span>
                          <span className="font-mono font-medium text-slate-500">
                            {cnt} adet ({percent.toFixed(1)}%)
                          </span>
                        </div>
                        {/* Interactive SVG Bar */}
                        <div className="w-full bg-stone-100 h-6 rounded-lg overflow-hidden border border-stone-200/40 relative">
                          <div 
                            className={`h-full opacity-85 transition-all duration-1000 ${
                              key === 'REG' ? 'bg-rose-500' : 
                              key === 'GEO' ? 'bg-emerald-500' : 
                              key === 'LOC' ? 'bg-sky-500' : 
                              key === 'FAC' ? 'bg-purple-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                          {/* Inner hover count visual */}
                          <div className="absolute inset-y-0 left-3 flex items-center">
                            <span className="text-[10px] text-slate-900 font-bold uppercase tracking-widest">{key}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chart 2: Co-occurrence Grid Heatmap */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col gap-4">
                <div>
                  <h3 className="font-serif text-lg font-semibold text-slate-950">Varlık Birlikte Görünüm Matrisi</h3>
                  <p className="text-xs text-slate-500 leading-normal mt-1">Aynı cümlede geçen varlık tiplerinin birlikte görülme sıklığını gösteren tablo.</p>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  <div className="grid grid-cols-6 gap-1 max-w-md mx-auto w-full">
                    
                    {/* Header Blank Corner */}
                    <div className="text-center p-1.5"></div>
                    
                    {/* Col headers */}
                    {['REG', 'GEO', 'LOC', 'FAC', 'SAC'].map(h => (
                      <div key={h} className="text-center p-1 font-mono text-[9px] font-bold text-slate-400 uppercase flex items-center justify-center">
                        {h}
                      </div>
                    ))}

                    {/* Row headers & cells */}
                    {['REG', 'GEO', 'LOC', 'FAC', 'SAC'].map((rowKey) => {
                      return (
                        <div key={rowKey} className="contents">
                          <div className="font-mono text-[10px] font-bold text-slate-500 flex items-center justify-start pr-1 border-r border-stone-100 uppercase">
                            {rowKey}
                          </div>
                          {['REG', 'GEO', 'LOC', 'FAC', 'SAC'].map((colKey) => {
                            const val = cooccurrenceData[rowKey]?.[colKey] || 0;
                            let intensityBg = 'bg-stone-50 text-slate-300';
                            let borderCol = 'border-stone-105';
                            if (val > 0) {
                              if (val < 5) { intensityBg = 'bg-rose-50 text-rose-700'; borderCol = 'border-rose-100'; }
                              else if (val < 15) { intensityBg = 'bg-rose-100 text-rose-800 font-semibold'; borderCol = 'border-rose-200'; }
                              else if (val < 35) { intensityBg = 'bg-rose-200 text-rose-900 font-bold'; borderCol = 'border-rose-300'; }
                              else { intensityBg = 'bg-rose-500 text-white font-extrabold'; borderCol = 'border-rose-600'; }
                            }
                            return (
                              <div
                                key={colKey}
                                className={`text-center py-3 rounded-md text-xs border ${intensityBg} ${borderCol} flex flex-col items-center justify-center relative group select-none transition-transform duration-100 hover:scale-105 hover:z-10`}
                              >
                                <span>{val}</span>
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-slate-900 text-white text-[9px] py-1 px-1.5 rounded shadow z-30 whitespace-nowrap leading-none">
                                  {rowKey} & {colKey}: {val} eşleşme
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-center gap-4 mt-5 text-[10px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-stone-50 border border-stone-200 rounded block" />
                      <span>Sonuç bulunamadı</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-rose-50 border border-rose-100 rounded block" />
                      <span>Düşük</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-rose-200 border border-rose-300 rounded block" />
                      <span>Orta</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-rose-500 border border-rose-600 rounded block" />
                      <span>Yüksek</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>



            {/* Bottom Section: Top tokens ranking chart */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm">
              <h3 className="font-serif text-lg font-semibold text-slate-950 mb-0.5">Sık Kullanılan Varlıklar</h3>
              <p className="text-xs text-slate-500 mb-6">Etiketli metinlerde en sık geçen 8 anahtar kelimenin frekans analizi.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {stats.topEntities.map((ent, idx) => {
                  const percentOfTotal = ((ent.count / stats.totalEntities) * 100).toFixed(1);
                  const config = ENTITY_TYPES[ent.label as keyof typeof ENTITY_TYPES];
                  
                  return (
                    <div key={idx} className="bg-stone-50/50 p-4 rounded-xl border border-stone-200/60 flex flex-col justify-between hover:border-orange-200 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-mono">Sıra #{idx + 1}</span>
                          <span className="font-serif font-semibold text-base text-slate-900 mt-0.5 truncate max-w-[130px]">
                            {ent.text}
                          </span>
                        </div>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0 ${config.badge}`}>
                          {ent.label}
                        </span>
                      </div>
                      
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold font-serif text-slate-950">{ent.count}</span>
                          <span className="text-[10px] text-slate-400 font-mono">defa</span>
                        </div>
                        <span className="text-[11px] font-mono font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                          %{percentOfTotal} pay
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* TAB 5: Live NER Predictions Playground & Raw Exporter */}
        {activeTab === 'export' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animation-fade-in">
            
            {/* Left Box: Live playground extractor emulator */}
            <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col gap-5">
              <div>
                <h3 className="font-serif text-lg font-semibold text-slate-950 flex items-center gap-1.5">
                  <Brain className="text-orange-600" size={18} />
                  <span>Etkileşimli Varlık Çıkarıcı</span>
                </h3>
                <p className="text-xs text-slate-500 leading-normal mt-1">
                  Aşağıdaki alana kendi Rusça veya Kırım Tatarca cümlenizi yazın. Entegre kelime dağarcığı sözlüğü, eşleşen yapıları anında renklendirecektir!
                </p>
              </div>

              {/* Text Area */}
              <div className="flex flex-col gap-2">
                <textarea
                  value={playgroundText}
                  onChange={(e) => setPlaygroundText(e.target.value)}
                  placeholder="Kırım efsanelerinden bir metin girin..."
                  rows={4}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-4 text-xs md:text-sm font-serif focus:outline-none focus:border-rose-500 focus:bg-white text-slate-900 leading-relaxed shadow-inner"
                  id="playground-textarea"
                />
                

              </div>

              {/* Outputs representation */}
              <div className="bg-stone-50 p-5 rounded-xl border border-stone-200/50">
                <h4 className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Gerçek Zamanlı NER Çıktısı (Öngörü)
                </h4>
                
                <div className="p-4 bg-white rounded-lg border border-stone-150 leading-relaxed font-serif text-slate-900 text-sm md:text-base">
                  {simulatedPlaygroundEntities.length === 0 ? (
                    renderHighlightedText(playgroundText, [])
                  ) : (
                    renderHighlightedText(playgroundText, simulatedPlaygroundEntities)
                  )}
                </div>

                {simulatedPlaygroundEntities.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-slate-400 font-mono w-full block mb-1">Çıkarılan Varlıklar (Entities):</span>
                    {simulatedPlaygroundEntities.map((ent, i) => (
                      <span key={i} className="text-xs bg-white text-slate-700 px-2 py-1 rounded border border-stone-200 flex items-center gap-1.5 shadow-sm">
                        <span className={`w-1.5 h-1.5 rounded-full ${ent.label === 'REG' ? 'bg-rose-500' : ent.label === 'GEO' ? 'bg-emerald-500' : ent.label === 'LOC' ? 'bg-sky-500' : ent.label === 'FAC' ? 'bg-purple-500' : 'bg-amber-500'}`} />
                        <span><strong>{ent.text}</strong> ({ent.label})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Box: Live export database download options */}
            <div className="lg:col-span-5 bg-white p-6 md:p-8 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col gap-6">
              
              <div>
                <h3 className="font-serif text-lg font-semibold text-slate-950 flex items-center gap-1.5">
                  <Database className="text-orange-600" size={18} />
                  <span>Dışa Aktarma (Akademik)</span>
                </h3>
                <p className="text-xs text-slate-500 leading-normal mt-1 text-justify">
                  Veri kümelerinizi istediğiniz NLP eğitim formatında tek tıkla dışa aktarın ve araştırma ortamınıza, analiz araçlarınıza veya ortak çalışma depolarınıza kolayca aktarın.
                </p>
              </div>

              {/* Box 1 */}
              <div className="p-4 rounded-xl border border-stone-150 bg-stone-50/50 hover:border-orange-200 transition-colors flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold">1</div>
                <div className="flex-1 space-y-1">
                  <h4 className="text-xs font-semibold text-slate-950">JSON Lines (.jsonl)</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    HuggingFace ve SpaCy ile uyumlu satır bazlı veri formatı.
                  </p>
                  <button
                    onClick={() => triggerDownload('jsonl')}
                    className="mt-2 text-xs text-orange-700 border border-orange-200 hover:bg-orange-50 px-2.5 py-1 rounded inline-flex items-center gap-1 font-medium cursor-pointer shadow-sm bg-white"
                    id="download-jsonl-btn"
                  >
                    <Download size={12} />
                    <span>İndir (JSONL)</span>
                  </button>
                </div>
              </div>

              {/* Box 2 */}
              <div className="p-4 rounded-xl border border-stone-150 bg-stone-50/50 hover:border-sky-200 transition-colors flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">2</div>
                <div className="flex-1 space-y-1">
                  <h4 className="text-xs font-semibold text-slate-950">CSV / Excel (.csv)</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    SPSS, R, Pandas ve MATLAB ile uyumlu tablo veri formatı.
                  </p>
                  <button
                    onClick={() => triggerDownload('csv')}
                    className="mt-2 text-xs text-sky-700 border border-sky-200 hover:bg-sky-50 px-2.5 py-1 rounded inline-flex items-center gap-1 font-medium cursor-pointer shadow-sm bg-white"
                    id="download-csv-btn"
                  >
                    <Download size={12} />
                    <span>İndir (CSV)</span>
                  </button>
                </div>
              </div>

              {/* Box 3 */}
              <div className="p-4 rounded-xl border border-stone-150 bg-stone-50/50 hover:border-emerald-200 transition-colors flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">3</div>
                <div className="flex-1 space-y-1">
                  <h4 className="text-xs font-semibold text-slate-950">BIO/IOB (.iob)</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    NLTK, Flair, Stanford CoreNLP ve CRF modelleriyle uyumlu standart NER eğitim veri formatı.
                  </p>
                  <button
                    onClick={() => triggerDownload('iob')}
                    className="mt-2 text-xs text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-2.5 py-1 rounded inline-flex items-center gap-1 font-medium cursor-pointer shadow-sm bg-white"
                    id="download-iob-btn"
                  >
                    <Download size={12} />
                    <span>İndir (IOB)</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Footer Area */}
      <footer className="border-t border-stone-200 bg-stone-50 py-8 px-4 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <span className="font-serif font-semibold text-slate-800 text-sm block">III. Uluslararası Bilim, Yazı ve Edebiyat Dili Olarak Türkçe Sempozyumu, 18-19-20 Mayıs 2026.</span>
            <span className="block mt-0.5 text-stone-400">© 2026 Bu platformdaki tüm içerikler telif hakkı ile korunmaktadır.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
