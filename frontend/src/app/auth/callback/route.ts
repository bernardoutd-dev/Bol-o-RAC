import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    
    // Troca o código da URL pela sessão do usuário e salva nos cookies
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Deu tudo certo. Manda o usuário para a tela dos jogos (ainda vamos criar)
      return NextResponse.redirect(`${requestUrl.origin}/jogos`)
    }
  }

  // Se o link expirou ou foi fraudado, devolve pra tela inicial
  return NextResponse.redirect(`${requestUrl.origin}/?error=acesso_negado`)
}