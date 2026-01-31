import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const characterId = formData.get('characterId') as string

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client with service role for storage access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Generate unique filename
    const filename = `${characterId || 'unknown'}-${Date.now()}.png`
    const filePath = `tokens/${filename}`

    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // Upload to Supabase Storage
    const { data, error } = await supabaseClient.storage
      .from('owlcloud-assets')
      .upload(filePath, uint8Array, {
        contentType: 'image/png',
        upsert: false
      })

    if (error) {
      console.error('Upload error:', error)
      return new Response(
        JSON.stringify({ error: `Upload failed: ${error.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from('owlcloud-assets')
      .getPublicUrl(filePath)

    return new Response(
      JSON.stringify({
        success: true,
        url: urlData.publicUrl,
        path: filePath
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Function error:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
