
/// <reference lib="dom" />
import React, { useState, useEffect, useRef } from 'react';
import { X, Globe, LayoutTemplate, ArrowRight, Loader2, Link2, RefreshCw, Rss, Newspaper, ExternalLink, CheckSquare, Square, AlertTriangle, Trash2, DownloadCloud } from 'lucide-react';
import { NewsDraft } from '../types';
import { fetchWithFallback, getCorsImageUrl } from '../utils/proxyHelper';

interface Props {
    onClose: () => void;
    onApply: (drafts: NewsDraft[]) => void;
    maxSelection?: number;
}

interface NewsItem {
    id: string; // Added ID for selection tracking
    title: string;
    description: string;
    link: string;
    image: string;
    source: string;
    pubDate: string;
}

// EXPANDED SOURCE LIST (Includes Viral/Trending sections to cover Social Media topics)
const RSS_FEEDS = [
    // GROUP A: CORE NEWS
    { name: 'CNN Nasional', url: 'https://www.cnnindonesia.com/nasional/rss', color: 'bg-red-600' },
    { name: 'Detik News', url: 'https://news.detik.com/rss', color: 'bg-blue-600' },
    { name: 'Kompas', url: 'https://www.kompas.com/rss/news', color: 'bg-blue-800' },
    { name: 'Antara', url: 'https://www.antaranews.com/rss/terkini.xml', color: 'bg-yellow-600' },
    { name: 'Tempo', url: 'https://rss.tempo.co/nasional', color: 'bg-red-800' },
    
    // GROUP B: LIFESTYLE & ENTERTAINMENT
    { name: 'CNN Hiburan', url: 'https://www.cnnindonesia.com/hiburan/rss', color: 'bg-red-500' },
    { name: 'Detik Hot', url: 'https://hot.detik.com/rss', color: 'bg-purple-600' },
    { name: 'Liputan6', url: 'https://feed.liputan6.com/rss', color: 'bg-orange-600' },
    
    // GROUP C: TRENDING / VIRAL (Social Media Proxies)
    { name: 'Tribun News', url: 'https://www.tribunnews.com/rss', color: 'bg-blue-500' },
    { name: 'Suara.com', url: 'https://www.suara.com/rss/news', color: 'bg-green-600' },
    { name: 'Merdeka', url: 'https://www.merdeka.com/feed', color: 'bg-red-700' },
    { name: 'Viva.co.id', url: 'https://www.viva.co.id/rss', color: 'bg-yellow-700' },
    { name: 'Okezone', url: 'https://sindikasi.okezone.com/index.php/rss/0/RSS', color: 'bg-blue-400' },
    { name: 'Kumparan', url: 'https://lapi.kumparan.com/v2.0/rss/', color: 'bg-teal-600' },
    
    // GROUP D: BUSINESS & OTHERS
    { name: 'CNBC Indo', url: 'https://www.cnbcindonesia.com/news/rss', color: 'bg-blue-900' },
    { name: 'Jawa Pos', url: 'https://www.jawapos.com/rss', color: 'bg-blue-700' },
    { name: 'Republika', url: 'https://www.republika.co.id/rss', color: 'bg-green-700' }
];

// --- TEXT UTILS FOR PROFESSIONAL STYLING ---

function smartShortenTitle(title: string): string {
    // 1. Initial Clean (Brackets, Prefixes, Suffixes)
    let clean = title.replace(/[\[\(].*?[\]\)]/g, '').trim();
    
    // Remove typical news prefixes to keep it clean but FULL
    clean = clean.replace(/^(LIVE|BREAKING|UPDATE|EKSKLUSIF|POPULER|TERBARU|TOP NEWS|HEBOH|Jadwal|Hasil|Klasemen|Fakta|SIMAK|CEK|PENTING|WOW|VIRAL|FOTO|VIDEO)\s*[-:]?\s*/i, '');
    
    // Remove media source suffixes (e.g. - Detik)
    clean = clean.replace(/\s*[-|]\s*(Detik|CNN|Kompas|Tribun|Antara|Suara|CNBC|Merdeka|Liputan6|Viva|Okezone|Kumparan|BeritaSatu|Tempo|Jawa Pos|Republika).*$/i, '');

    // 2. Remove non-alphanumeric start
    clean = clean.replace(/^[^a-zA-Z0-9]+/, '');

    return clean.toUpperCase();
}

function smartCleanSummary(rawDescription: string): string {
    // 1. Basic cleaning (HTML)
    const div = document.createElement("div");
    div.innerHTML = rawDescription;
    let text = div.textContent || rawDescription;
    
    // 2. Decode entities
    text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    
    // 3. Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // 4. Remove typical Indonesian news location/source prefixes
    text = text.replace(/^([A-Z][a-z]+(\s[A-Z][a-z]+)*)?\s*[,(-]\s*(CNN|Antara|Detik|Kompas|Tribun|Liputan6|Viva|Suara|CNBC|Merdeka|Kumparan|JawaPos).*?[-–:]\s*/i, '');
    text = text.replace(/^[A-Z][a-z]+, \d+ [A-Z][a-z]+ \d+ - /, ''); // Date pattern "Jakarta, 20 Mei 2024 - "
    
    // 5. Remove junk phrases
    const junkPatterns = [
        /Baca selengkapnya.*/i,
        /Simak di sini.*/i,
        /Selengkapnya.*/i,
        /Artikel ini telah tayang.*/i,
        /SCROLL TO CONTINUE WITH CONTENT/i,
        /FOTO:/i, /VIDEO:/i, /INFOGRAFIS:/i,
        /Jakarta - /i,
        /Suara\.com - /i,
        /Liputan6\.com, /i,
        /Halaman Selanjutnya/i
    ];
    junkPatterns.forEach(p => text = text.replace(p, ''));
    text = text.trim();
    
    // 6. Ensure complete sentences (No hanging info)
    // Updated regex to treat newlines as potential sentence breaks
    const sentences = text.match(/[^.!?\n]+[.!?\n]+["']?/g);
    
    // Fallback if regex fails (return raw text slice up to 300 chars)
    if (!sentences || sentences.length === 0) {
        return text.length > 300 ? text.substring(0, 597) + "..." : text;
    }
    
    let summary = "";
    for (const s of sentences) {
        const potentialLength = (summary + s).length;

        // 1. HARD LIMIT (300 chars to fit in layout box)
        if (potentialLength > 300) break;

        summary += s + " ";
    }
    
    summary = summary.trim();
    
    if (!summary && sentences.length > 0) {
         summary = sentences[0];
    }
    
    return summary;
}
// -------------------------------------------

export const NewsWorkspace: React.FC<Props> = ({ onClose, onApply, maxSelection = 0 }) => {
    const [activeTab, setActiveTab] = useState<'trending' | 'link' | 'downloader'>('trending');
    
    // Data State
    const [newsList, setNewsList] = useState<NewsItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Selection State
    const [selectedNewsIds, setSelectedNewsIds] = useState<Set<string>>(new Set());

    // Link Analyze State
    const [urlInputs, setUrlInputs] = useState<string[]>(['']);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Staging / Draft State (Single Item Editing)
    const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftSummary, setDraftSummary] = useState('');
    const [draftImage, setDraftImage] = useState('');

    // Refs
    const activeIdRef = useRef<string | null>(null);

    // Update Ref whenever activePreviewId changes
    useEffect(() => {
        activeIdRef.current = activePreviewId;
    }, [activePreviewId]);

    // Init URL inputs
    useEffect(() => {
        const count = maxSelection > 0 ? maxSelection : 1;
        setUrlInputs(prev => {
            if (prev.length === count) return prev;
            return Array(count).fill('').map((_, i) => prev[i] || '');
        });
    }, [maxSelection]);

    // --- EFFECT: ENHANCE IMAGE ON SELECTION ---
    useEffect(() => {
        if (!activePreviewId) return;
        const item = newsList.find(n => n.id === activePreviewId);
        if (!item) return;

        // Condition: Force Crawl for Google News or Placeholders
        const isGoogle = item.source === 'Google News' || item.link.includes('google.com');
        const isPlaceholder = item.image.includes('placeholder') || item.image.includes('No+Image');

        if (isGoogle || isPlaceholder) {
            // Async Crawl
            const performCrawl = async () => {
                try {
                    // Fetch original page via proxy
                    const html = await fetchWithFallback(item.link);
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, "text/html");
                    
                    // Look for OG Image
                    let highResImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                                       doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
                    
                    if (highResImage) {
                         // Resolve relative URLs if needed
                         try { highResImage = new URL(highResImage, item.link).href; } catch(e) {}
                         
                         // Fix Protocol Relative
                         if (highResImage.startsWith('//')) highResImage = 'https:' + highResImage;

                         // Valid Check
                         if (highResImage && highResImage !== item.image) {
                             console.log("Found High-Res Image:", highResImage);
                             
                             // 1. Update List Data
                             setNewsList(prev => prev.map(n => n.id === item.id ? { ...n, image: highResImage! } : n));

                             // 2. Update Draft Preview (Only if user hasn't switched items)
                             if (activeIdRef.current === item.id) {
                                 setDraftImage(highResImage);
                             }
                         }
                    }
                } catch (e) {
                    console.warn("Auto-Crawl failed for:", item.title, e);
                }
            };
            
            performCrawl();
        }
    }, [activePreviewId]); // Run when selection changes

    // --- LOGIC: FETCH NEWS (TRENDING) ---
    const fetchNewsData = async () => {
        setIsLoading(true);
        setErrorMsg('');
        setNewsList([]);
        
        const allItems: NewsItem[] = [];
        const targetFeeds = RSS_FEEDS;

        try {
            // Using Promise.all to fetch concurrently
            const promises = targetFeeds.map(async (feed) => {
                try {
                    // RSS2JSON is robust and handles CORS internally
                    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
                    
                    const res = await fetch(apiUrl);
                    const data = await res.json();
                    
                    if (data.status === 'ok' && data.items) {
                        data.items.forEach((item: any) => {
                            // Find Image - Improved Logic using DOMParser for reliability
                            let image = "";
                            
                            // 1. Try Enclosure (if available and looks like image)
                            if (item.enclosure && item.enclosure.link && item.enclosure.type?.startsWith('image')) {
                                image = item.enclosure.link;
                            } 
                            // 2. Try Thumbnail field (rss2json sometimes extracts this)
                            else if (item.thumbnail && typeof item.thumbnail === 'string' && item.thumbnail.length > 0) {
                                image = item.thumbnail;
                            }

                            // 3. Fallback / Priority for Google News: Scan HTML content
                            if (!image || feed.name === 'Google News' || item.link.includes('google.com')) {
                                try {
                                    const rawHtml = (item.description || "") + (item.content || "");
                                    const parser = new DOMParser();
                                    const doc = parser.parseFromString(rawHtml, "text/html");
                                    
                                    // Try getting first IMG tag
                                    const imgTag = doc.querySelector('img');
                                    if (imgTag) {
                                        const src = imgTag.getAttribute('src');
                                        if (src) image = src;
                                    }
                                    
                                    // Backup regex if DOM fails
                                    if (!image) {
                                        const match = rawHtml.match(/src="([^"]+)"/);
                                        if (match) image = match[1];
                                    }
                                } catch (e) {
                                    // Ignore parse errors
                                }
                            }
                            
                            // 4. Default Placeholder if still empty
                            if (!image) {
                                image = "https://via.placeholder.com/800x450?text=No+Image";
                            }
                            
                            // Fix protocol relative URLs
                            if (image.startsWith('//')) {
                                image = 'https:' + image;
                            }

                            const proTitle = smartShortenTitle(item.title);
                            
                            // PRIORITY: Use 'content' if available and longer than 'description'
                            let rawText = item.description || "";
                            if (item.content && item.content.length > rawText.length) {
                                rawText = item.content;
                            }

                            const proSummary = smartCleanSummary(rawText);
                            
                            allItems.push({
                                id: item.link || Math.random().toString(),
                                title: proTitle,
                                description: proSummary,
                                link: item.link,
                                image,
                                source: feed.name === 'Google News' ? 'Google News' : feed.name,
                                pubDate: new Date(item.pubDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                            });
                        });
                    }
                } catch (err) {
                    console.warn(`Failed to load feed ${feed.name}`, err);
                }
            });

            await Promise.all(promises);
            
            if (allItems.length === 0) {
                 setErrorMsg("Gagal memuat berita trending.");
            } else {
                 setNewsList(allItems.sort(() => 0.5 - Math.random()));
            }
        } catch (err) {
            setErrorMsg("Gagal memuat berita. Periksa koneksi internet.");
        } finally {
            setIsLoading(false);
        }
    };

    // Initial Load (Trending)
    useEffect(() => {
        if (activeTab === 'trending' && newsList.length === 0) fetchNewsData();
    }, [activeTab]);


    // --- LOGIC B: ANALYZE LINKS (BATCH SUPPORT) ---
    const handleAnalyzeLinks = async () => {
        const validUrls = urlInputs.filter(u => u.trim().length > 0);
        if (validUrls.length === 0) return;
        
        setIsAnalyzing(true);
        setErrorMsg('');
        
        const newItems: NewsItem[] = [];

        try {
            for (const url of validUrls) {
                try {
                    const htmlString = await fetchWithFallback(url);
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlString, "text/html");

                    const getMeta = (prop: string) => (
                        doc.querySelector(`meta[property="${prop}"]`)?.getAttribute("content") ||
                        doc.querySelector(`meta[name="${prop}"]`)?.getAttribute("content") ||
                        ""
                    );

                    const rawTitle = getMeta("og:title") || doc.title || "No Title Found";
                    const rawDescription = getMeta("og:description") || getMeta("description") || "No description available.";
                    
                    let image = getMeta("og:image");
                    if (!image) {
                        image = "https://via.placeholder.com/800x450?text=Web+Image";
                    } else {
                        try { image = new URL(image, url).href; } catch (e) {}
                    }
                    
                    const siteName = getMeta("og:site_name") || new URL(url).hostname;

                    newItems.push({
                        id: url,
                        title: smartShortenTitle(rawTitle),
                        description: smartCleanSummary(rawDescription),
                        link: url,
                        image,
                        source: siteName,
                        pubDate: "Just Now"
                    });
                } catch (e) {
                    console.error("Failed to parse", url, e);
                }
            }

            if (newItems.length > 0) {
                setNewsList(prev => [...newItems, ...prev]);
                newItems.forEach(item => {
                    if (maxSelection === 0 || selectedNewsIds.size + newItems.length <= maxSelection + 5) {
                         toggleSelection(item.id);
                    }
                });
                loadPreview(newItems[0]);
            } else {
                setErrorMsg("Gagal menganalisa link. Website mungkin memblokir akses.");
            }
        } catch (err) {
            setErrorMsg("Terjadi kesalahan sistem saat analisa link.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // --- SELECTION LOGIC ---
    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedNewsIds);
        if (newSet.has(id)) {
            newSet.delete(id);
            if (activePreviewId === id) setActivePreviewId(null);
        } else {
            if (maxSelection > 0 && newSet.size >= maxSelection) return;
            newSet.add(id);
            const item = newsList.find(n => n.id === id);
            if (item) loadPreview(item);
        }
        setSelectedNewsIds(newSet);
    };

    const loadPreview = (item: NewsItem) => {
        setActivePreviewId(item.id);
        setDraftTitle(item.title);
        setDraftSummary(item.description);
        setDraftImage(item.image);
    };

    // --- APPLY LOGIC ---
    const handleApplyClick = () => {
        const selectedIdsArray = Array.from(selectedNewsIds);
        if (selectedIdsArray.length === 0) return;

        const drafts: NewsDraft[] = selectedIdsArray.map(id => {
            if (id === activePreviewId) {
                // If it's the currently active one, use the potentially edited/crawled draft state
                const original = newsList.find(n => n.id === id);
                return {
                    title: draftTitle,
                    summary: draftSummary,
                    imageUrl: draftImage, // This will have the enhanced image
                    source: original ? original.source : 'Web'
                };
            } else {
                const item = newsList.find(n => n.id === id)!;
                return {
                    title: item.title,
                    summary: item.description,
                    imageUrl: item.image, // This comes from newsList, which we update in the Effect
                    source: item.source
                };
            }
        });

        onApply(drafts);
    };

    const activeItem = activePreviewId ? newsList.find(n => n.id === activePreviewId) : null;
    const selectedCount = selectedNewsIds.size;
    const isLimitReached = maxSelection > 0 && selectedCount >= maxSelection;

    const updateUrlInput = (index: number, val: string) => {
        const newInputs = [...urlInputs];
        newInputs[index] = val;
        setUrlInputs(newInputs);
    };

    const clearAllInputs = () => {
        setUrlInputs(Array(urlInputs.length).fill(''));
    };

    return (
        <div className="fixed inset-0 z-[999] bg-[#0f0f0f] text-white flex flex-col font-roboto animate-in fade-in duration-200">
            {/* Header */}
            <div className="h-16 border-b border-[#2a2a2a] bg-[#181818] flex items-center justify-between px-6 shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <Globe className="text-blue-500" />
                    <div>
                        <h1 className="text-lg font-bold tracking-wide">News Research Mode</h1>
                        <p className="text-[10px] text-gray-500">Real-time RSS & Link Scraper</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-[#2a2a2a] rounded-full transition text-gray-400 hover:text-white">
                    <X />
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
                {/* LEFT PANEL: Sources */}
                <div className="w-1/2 border-r border-[#2a2a2a] flex flex-col bg-[#121212]">
                    <div className="flex border-b border-[#2a2a2a]">
                        <button 
                            onClick={() => setActiveTab('trending')}
                            className={`flex-1 py-4 text-xs font-bold flex items-center justify-center gap-2 transition ${activeTab === 'trending' ? 'bg-[#1a1a1a] text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:bg-[#1a1a1a]'}`}
                        >
                            <Rss size={14} /> TRENDING
                        </button>
                        <button 
                            onClick={() => setActiveTab('link')}
                            className={`flex-1 py-4 text-xs font-bold flex items-center justify-center gap-2 transition ${activeTab === 'link' ? 'bg-[#1a1a1a] text-purple-400 border-b-2 border-purple-500' : 'text-gray-500 hover:bg-[#1a1a1a]'}`}
                        >
                            <Link2 size={14} /> PASTE LINK {maxSelection > 1 && `(${maxSelection})`}
                        </button>
                        <button 
                            onClick={() => setActiveTab('downloader')}
                            className={`flex-1 py-4 text-xs font-bold flex items-center justify-center gap-2 transition ${activeTab === 'downloader' ? 'bg-[#1a1a1a] text-green-400 border-b-2 border-green-500' : 'text-gray-500 hover:bg-[#1a1a1a]'}`}
                        >
                            <DownloadCloud size={14} /> DOWNLOADER
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 relative">
                        {activeTab === 'trending' && (
                            <div className="space-y-4 pb-16">
                                <div className="flex justify-between items-center mb-2 border-b border-[#2a2a2a] pb-2 pt-2">
                                    <span className="text-[10px] text-gray-500 font-bold">
                                        🔥 TRENDING NEWS ({newsList.length})
                                    </span>
                                    <button onClick={() => fetchNewsData()} className="text-gray-400 hover:text-white"><RefreshCw size={12} /></button>
                                </div>
                                
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-2">
                                        <Loader2 size={24} className="animate-spin" />
                                        <span className="text-xs">
                                            Mengambil berita trending...
                                        </span>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {newsList.map((item, idx) => {
                                            const isSelected = selectedNewsIds.has(item.id);
                                            const isDisabled = isLimitReached && !isSelected;
                                            
                                            return (
                                                <div 
                                                    key={item.id + idx}
                                                    onClick={() => !isDisabled && loadPreview(item)}
                                                    className={`p-3 rounded-lg border transition flex gap-3 group relative 
                                                        ${isDisabled ? 'opacity-40 cursor-not-allowed border-[#222]' : 'cursor-pointer'}
                                                        ${activePreviewId === item.id ? 'bg-[#222]' : 'bg-[#1a1a1a]'} 
                                                        ${isSelected ? 'border-blue-500 bg-blue-900/10' : (!isDisabled ? 'border-[#2a2a2a] hover:border-gray-500' : '')}
                                                    `}
                                                >
                                                    {/* Checkbox Overlay */}
                                                    <div 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            if (!isDisabled || isSelected) toggleSelection(item.id); 
                                                        }}
                                                        className={`absolute top-3 right-3 z-10 ${isDisabled ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-white cursor-pointer'}`}
                                                    >
                                                        {isSelected ? <CheckSquare className="text-blue-500 fill-blue-500/20" size={20} /> : <Square size={20} />}
                                                    </div>

                                                    <div className="w-20 h-20 shrink-0 bg-gray-800 rounded overflow-hidden opacity-90 group-hover:opacity-100 relative">
                                                        <img 
                                                            src={item.image} 
                                                            className="w-full h-full object-cover" 
                                                            onError={(e) => {
                                                                const target = e.currentTarget;
                                                                target.onerror = null; // Prevent loop
                                                                target.src = 'https://via.placeholder.com/100?text=News';
                                                            }}
                                                        />
                                                        {item.source === 'Google News' && item.image.includes('placeholder') && (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[8px] text-gray-300 text-center px-1">
                                                                Click to Load
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0 pr-6">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 font-bold">{item.source}</span>
                                                            <span className="text-[9px] text-gray-500">{item.pubDate}</span>
                                                        </div>
                                                        <h3 className={`font-bold text-sm leading-tight line-clamp-2 mb-1 transition ${isSelected ? 'text-blue-300' : 'text-gray-200 group-hover:text-blue-400'}`}>{item.title}</h3>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {newsList.length === 0 && !errorMsg && (
                                            <div className="text-center py-10 text-gray-500 text-xs bg-[#1a1a1a] rounded p-4 border border-dashed border-[#333]">
                                                Tidak ada berita ditemukan.
                                            </div>
                                        )}
                                        {errorMsg && (
                                            <div className="text-center py-10 text-red-500 text-xs">{errorMsg}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'link' && (
                            <div className="flex flex-col h-full justify-start max-w-sm mx-auto w-full pt-4">
                                <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#333] flex flex-col h-full">
                                    <div className="text-center mb-4">
                                        <Link2 size={32} className="mx-auto text-purple-500 mb-2 opacity-80" />
                                        <h3 className="text-sm font-bold text-white mb-1">Analisa URL Berita</h3>
                                        <p className="text-[10px] text-gray-400">
                                            {maxSelection > 1 
                                                ? `Masukkan hingga ${maxSelection} link untuk diproses ke masing-masing video background.` 
                                                : "Paste link berita untuk dianalisa otomatis."}
                                        </p>
                                    </div>

                                    {/* INPUT LIST SCROLLABLE */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-4 pr-1 max-h-[40vh]">
                                        {urlInputs.map((val, idx) => (
                                            <div key={idx} className="relative">
                                                {maxSelection > 1 && (
                                                    <label className="text-[9px] text-gray-500 uppercase font-bold mb-1 block pl-1">
                                                        Video #{idx + 1}
                                                    </label>
                                                )}
                                                <input 
                                                    type="text" placeholder="https://..." value={val}
                                                    onChange={e => updateUrlInput(idx, e.target.value)}
                                                    className="w-full bg-[#0f0f0f] border border-[#333] rounded-lg px-3 py-2 text-xs focus:border-purple-500 focus:outline-none text-white font-mono"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        {maxSelection > 1 && (
                                            <button 
                                                onClick={clearAllInputs}
                                                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition"
                                                title="Clear All"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={handleAnalyzeLinks} 
                                            disabled={isAnalyzing || urlInputs.every(u => !u.trim())}
                                            className="flex-1 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-800 disabled:text-gray-600 text-white py-3 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2"
                                        >
                                            {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : `Analisa ${urlInputs.filter(u=>u.trim()).length > 0 ? urlInputs.filter(u=>u.trim()).length + ' Link' : 'Link'}`}
                                        </button>
                                    </div>

                                    {errorMsg && <p className="text-red-400 text-xs mt-3 bg-red-900/10 p-2 rounded text-center">{errorMsg}</p>}
                                </div>
                            </div>
                        )}

                        {activeTab === 'downloader' && (
                            <div className="flex flex-col h-full justify-start max-w-sm mx-auto w-full pt-4">
                                <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#333] flex flex-col h-full">
                                    <div className="text-center mb-6">
                                        <DownloadCloud size={32} className="mx-auto text-green-500 mb-2 opacity-80" />
                                        <h3 className="text-sm font-bold text-white mb-1">Sosmed Video Downloader</h3>
                                        <p className="text-[10px] text-gray-400">
                                            ⬇️ ⬇️ ⬇️
                                        </p>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        {[
                                            { name: 'SaveFrom.net', url: 'https://id.savefrom.net/', desc: 'All-in-One Downloader' },
                                            { name: 'SnapTik', url: 'https://snaptik.app/', desc: 'TikTok Downloader (No WM)' },
                                            { name: 'Y2Mate', url: 'https://www.y2mate.com/', desc: 'YouTube Downloader' },
                                            { name: 'SSSTik', url: 'https://ssstik.io/', desc: 'TikTok Downloader' },
                                            { name: 'SnapSave', url: 'https://snapsave.app/', desc: 'FB/IG Downloader' }
                                        ].map((site, i) => (
                                            <a 
                                                key={i} 
                                                href={site.url} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="flex items-center justify-between p-4 rounded-lg bg-[#252525] hover:bg-[#333] border border-gray-700 hover:border-green-500/50 transition group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-green-500 font-bold text-xs">
                                                        {i+1}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-gray-200 group-hover:text-green-400">{site.name}</div>
                                                        <div className="text-[9px] text-gray-500">{site.desc}</div>
                                                    </div>
                                                </div>
                                                <ExternalLink size={14} className="text-gray-600 group-hover:text-green-400" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL: Staging */}
                <div className="w-1/2 bg-[#0f0f0f] border-l border-[#2a2a2a] flex flex-col h-full overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                         <div className="flex flex-col max-w-lg mx-auto w-full pb-10">
                            <div className="mb-6 flex items-center justify-between border-b border-[#2a2a2a] pb-4">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <LayoutTemplate size={18} className="text-green-400" /> Staging Area
                                </h2>
                                {activeItem && (
                                    <a href={activeItem.link} target="_blank" rel="noreferrer" className="text-xs text-blue-400 flex items-center hover:underline">
                                        Visit Source <ExternalLink size={10} className="ml-1" />
                                    </a>
                                )}
                            </div>

                            {/* Info Banner for Max Selection */}
                            {maxSelection > 0 && (
                                <div className="mb-4 text-[10px] text-gray-400 flex items-center gap-2 bg-[#1a1a1a] p-2 rounded border border-gray-700">
                                    <span className="w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center font-bold text-white">{maxSelection}</span>
                                    <span>Kuota berita sesuai jumlah video background.</span>
                                </div>
                            )}

                            {selectedCount > 1 ? (
                                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6 text-center mb-6">
                                    <div className="bg-blue-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                                        {selectedCount}
                                    </div>
                                    <h3 className="text-xl font-bold text-blue-400 mb-2">{selectedCount} Berita Terpilih</h3>
                                    <p className="text-gray-400 text-xs mb-4">
                                        Anda telah memilih {selectedCount} berita. Sistem akan memprosesnya secara massal (Batch).
                                        Klik item di kiri untuk melihat preview detail satu per satu.
                                    </p>
                                </div>
                            ) : null}

                            {!activeItem ? (
                                <div className="text-center py-20 opacity-30">
                                    <Newspaper size={64} className="mx-auto mb-4" />
                                    <p>Select news from the left panel to edit here.</p>
                                </div>
                            ) : (
                                <div className="animate-in slide-in-from-right duration-300">
                                    {/* Preview Card */}
                                    <div className="bg-black border border-gray-700 rounded-lg p-2 mb-6">
                                        <div className="aspect-video bg-gray-900 rounded overflow-hidden relative mb-2">
                                            <img src={getCorsImageUrl(draftImage)} className="w-full h-full object-cover" />
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2">
                                                <p className="text-[10px] text-white font-mono">Layer: Image (Center)</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Inputs */}
                                    <div className="space-y-4 mb-8">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">HEADLINE (No Limit)</label>
                                            <textarea 
                                                rows={4} value={draftTitle} onChange={e => setDraftTitle(e.target.value)}
                                                className="w-full bg-[#1a1a1a] border border-[#333] rounded p-3 text-white font-bold text-lg focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">SUMMARY (~500 chars)</label>
                                            <textarea 
                                                rows={6} value={draftSummary} onChange={e => setDraftSummary(e.target.value)}
                                                className="w-full bg-[#1a1a1a] border border-[#333] rounded p-3 text-gray-300 text-sm focus:border-blue-500 focus:outline-none leading-relaxed"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {selectedCount > 0 && (
                                <button 
                                    onClick={handleApplyClick}
                                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-900/30 transition transform hover:scale-[1.02] active:scale-[0.98] mt-auto"
                                >
                                    {selectedCount > 1 ? `Gunakan ${selectedCount} Berita Terpilih` : 'GUNAKAN BERITA INI'}
                                    <ArrowRight size={18} />
                                </button>
                            )}
                         </div>
                    </div>
                </div>

                {/* FLOATING ALERT */}
                {isLimitReached && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
                        <div className="bg-orange-600/90 text-white px-6 py-3 rounded-full shadow-2xl backdrop-blur-md border border-orange-400/50 flex items-center gap-3">
                            <AlertTriangle size={20} className="text-yellow-300 animate-pulse" />
                            <div className="text-xs font-bold tracking-wide">
                                ANDA SUDAH MEMILIH {maxSelection} BERITA SESUAI DENGAN JUMLAH VIDEO BACKGROUND YANG ANDA UNGGAH
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
