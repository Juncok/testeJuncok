export const translateService = {
    translate: async (text, targetLang = 'pt-BR') => {
        if (!text || text === 'N/A') return text;

        // Limite da API MyMemory grátis é de 500 caracteres
        const MAX_LENGTH = 500;

        if (text.length <= MAX_LENGTH) {
            try {
                const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`);
                const data = await response.json();
                return data.responseData?.translatedText || text;
            } catch (error) {
                console.error('Translation error:', error);
                return text;
            }
        }

        // Se o texto for maior que 500 chars, dividimos em frases/pedaços
        const chunks = [];
        let currentText = text;

        while (currentText.length > 0) {
            let chunk = currentText.substring(0, MAX_LENGTH);

            // Tenta cortar no último ponto ou espaço para não quebrar frases ao meio
            if (currentText.length > MAX_LENGTH) {
                const lastDot = chunk.lastIndexOf('.');
                const lastSpace = chunk.lastIndexOf(' ');
                const splitIndex = lastDot > 300 ? lastDot + 1 : (lastSpace > 300 ? lastSpace : MAX_LENGTH);
                chunk = currentText.substring(0, splitIndex);
                currentText = currentText.substring(splitIndex);
            } else {
                currentText = '';
            }
            chunks.push(chunk.trim());
        }

        try {
            const translatedChunks = await Promise.all(chunks.map(async (c) => {
                const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(c)}&langpair=en|${targetLang}`);
                const data = await response.json();
                return data.responseData?.translatedText || c;
            }));
            return translatedChunks.join(' ');
        } catch (error) {
            console.error('Multi-chunk translation error:', error);
            return text;
        }
    }
};
