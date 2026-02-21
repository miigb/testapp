import { Router } from 'express'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'

const router = Router()

const summaryRequestSchema = z.object({
    moduleName: z.string(),
    contextData: z.unknown(),
})

router.post('/summary', async (req, res) => {
    try {
        const payload = summaryRequestSchema.parse(req.body)

        if (!process.env.GEMINI_API_KEY) {
            return res.status(503).json({
                error: 'A chave GEMINI_API_KEY não está configurada no servidor (verifique o ficheiro .env).',
            })
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

        const prompt = `
És um consultor financeiro especialista a analisar dados de uma plataforma de intermediação de crédito referente ao módulo: ${payload.moduleName}.
Analisa os seguintes dados em JSON e fornece um resumo conciso e profissional em Português de Portugal.
Destaca as métricas chave, volume financeiro, contagens, potenciais estrangulamentos na pipeline, e o desempenho global.
Gera no máximo 3 parágrafos curtos e diretos ao assunto sem floreados.
A resposta deve ser em puro Markdown sem a markdown codeblock envolvente (sem \`\`\`markdown). Utiliza **negrito** e listas normais quando for útil. Não tentes adivinhar dados que não estejam no JSON.

Dados do Módulo:
${JSON.stringify(payload.contextData, null, 2)}
`

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        })

        const summary = response.text
        return res.json({ summary })
    } catch (error) {
        console.error('AI Summary Error:', error)
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Payload inválido', details: error.errors })
        }
        return res.status(500).json({ error: 'Falha ao gerar o sumário de IA.' })
    }
})

export { router as aiRouter }
