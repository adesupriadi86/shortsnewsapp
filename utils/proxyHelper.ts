

export const getCorsImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    // Uses wsrv.nl to proxy and optimize the image, adding CORS headers
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=jpg`;
};

const TEXT_PROXIES = [
    (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`
];

export const fetchWithFallback = async (targetUrl: string) => {
    // Helper for timeout
    const fetchWithTimeout = (url: string, timeout = 5000) => {
        return Promise.race([
            fetch(url),
            new Promise<Response>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), timeout)
            )
        ]);
    };

    for (const createProxyUrl of TEXT_PROXIES) {
        try {
            const proxyUrl = createProxyUrl(targetUrl);
            const response = await fetchWithTimeout(proxyUrl);
            
            if (!response.ok) throw new Error("Proxy error");
            
            const text = await response.text();
            
            // Handle AllOrigins specific format
            if (proxyUrl.includes('api.allorigins.win')) {
                try {
                    const json = JSON.parse(text);
                    if (json.contents) return json.contents;
                } catch {
                    // if parse fails, return text as is
                }
            }
            return text;
        } catch (e) {
            console.warn(`Proxy failed for ${targetUrl}, trying next...`);
            continue;
        }
    }
    throw new Error("All proxies failed to fetch content or timed out.");
};
