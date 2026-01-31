-- OwlCloud Characters Table Schema
-- Stores character data for cloud sync and Discord bot integration

-- Create the owlcloud_characters table
CREATE TABLE IF NOT EXISTS public.owlcloud_characters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id_dicecloud VARCHAR(255) NOT NULL,  -- DiceCloud user ID (Meteor ID)
    dicecloud_character_id VARCHAR(255) NOT NULL,  -- DiceCloud character ID
    character_name VARCHAR(255) NOT NULL,     -- Character display name
    race VARCHAR(100),                           -- Character race
    class VARCHAR(100),                          -- Character class
    level INTEGER DEFAULT 1,                    -- Character level
    alignment VARCHAR(50),                        -- Character alignment
    hit_points JSONB,                            -- HP: {current: number, max: number}
    hit_dice JSONB,                              -- Hit dice: {current: number, max: number, type: string}
    temporary_hp INTEGER DEFAULT 0,              -- Temporary hit points
    death_saves JSONB,                           -- Death saves: {successes: number, failures: number}
    inspiration BOOLEAN DEFAULT false,           -- Inspiration status
    armor_class INTEGER DEFAULT 10,               -- AC value
    speed INTEGER DEFAULT 30,                     -- Speed value
    initiative INTEGER DEFAULT 0,                 -- Initiative value
    proficiency_bonus INTEGER DEFAULT 2,       -- Proficiency bonus
    attributes JSONB,                           -- Ability scores
    attribute_mods JSONB,                        -- Ability modifiers
    saves JSONB,                               -- Saving throws
    skills JSONB,                               -- Skill proficiencies
    spell_slots JSONB,                           -- Spell slot information
    resources JSONB,                             -- Class features/resources
    conditions JSONB,                            -- Status conditions
    raw_dicecloud_data JSONB,                    -- Full raw data from DiceCloud API for debugging/fallback
    pairing_id UUID REFERENCES public.owlcloud_pairings(id) ON DELETE SET NULL,  -- Discord pairing reference
    discord_user_id VARCHAR(255),               -- Discord user ID (linked account)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_owlcloud_characters_user_id_dicecloud ON public.owlcloud_characters(user_id_dicecloud);
CREATE INDEX IF NOT EXISTS idx_owlcloud_characters_dicecloud_character_id ON public.owlcloud_characters(dicecloud_character_id);
CREATE INDEX IF NOT EXISTS idx_owlcloud_characters_discord_user_id ON public.owlcloud_characters(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_owlcloud_characters_pairing_id ON public.owlcloud_characters(pairing_id);

-- Add comments for documentation
COMMENT ON TABLE public.owlcloud_characters IS 'Stores character data for cloud sync and Discord bot integration';
COMMENT ON COLUMN public.owlcloud_characters.id IS 'Primary key for character record';
COMMENT ON COLUMN public.owlcloud_characters.user_id_dicecloud IS 'DiceCloud user ID (Meteor ID) for character ownership';
COMMENT ON COLUMN public.owlcloud_characters.dicecloud_character_id IS 'DiceCloud character ID for reference';
COMMENT ON COLUMN public.owlcloud_characters.character_name IS 'Character display name';
COMMENT ON COLUMN public.owlcloud_characters.race IS 'Character race';
COMMENT ON COLUMN public.owlcloud_characters.class IS 'Character class';
COMMENT ON COLUMN public.owlcloud_characters.level IS 'Character level';
COMMENT ON COLUMN public.owlcloud_characters.alignment IS 'Character alignment';
COMMENT ON COLUMN public.owlcloud_characters.hit_points IS 'Hit points: {current, max}';
COMMENT ON COLUMN public.owlcloud_characters.hit_dice IS 'Hit dice: {current, max, type}';
COMMENT ON COLUMN public.owlcloud_characters.temporary_hp IS 'Temporary hit points';
COMMENT ON COLUMN public.owlcloud_characters.death_saves IS 'Death saves: {successes, failures}';
COMMENT ON COLUMN public.owlcloud_characters.inspiration IS 'Inspiration status';
COMMENT ON COLUMN public.owlcloud_characters.armor_class IS 'Armor class value';
COMMENT ON COLUMN public.owlcloud_characters.speed IS 'Speed value';
COMMENT ON COLUMN public.owlcloud_characters.initiative IS 'Initiative value';
COMMENT ON COLUMN public.owlcloud_characters.proficiency_bonus IS 'Proficiency bonus';
COMMENT ON COLUMN public.owlcloud_characters.attributes IS 'Ability scores (STR, DEX, CON, INT, WIS, CHA)';
COMMENT ON COLUMN public.owlcloud_characters.attribute_mods IS 'Ability modifiers';
COMMENT ON COLUMN public.owlcloud_characters.saves IS 'Saving throws';
COMMENT ON COLUMN public.owlcloud_characters.skills IS 'Skill proficiencies';
COMMENT ON COLUMN public.owlcloud_characters.spell_slots IS 'Spell slot information';
COMMENT ON COLUMN public.owlcloud_characters.resources IS 'Class features/resources';
COMMENT ON COLUMN public.owlcloud_characters.conditions IS 'Status conditions';
COMMENT ON COLUMN public.owlcloud_characters.raw_dicecloud_data IS 'Full raw data from DiceCloud API for debugging and fallback';
COMMENT ON COLUMN public.owlcloud_characters.pairing_id IS 'Discord pairing reference for bot commands';
COMMENT ON COLUMN public.owlcloud_characters.discord_user_id IS 'Discord user ID for linked accounts';
COMMENT ON COLUMN public.owlcloud_characters.created_at IS 'When the character was first stored';
COMMENT ON COLUMN public.owlcloud_characters.updated_at IS 'When the character was last updated';

-- Enable Row Level Security (RLS)
ALTER TABLE public.owlcloud_characters ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can only access their own characters
CREATE POLICY "Users can view own characters" ON public.owlcloud_characters
    FOR SELECT USING (
        auth.uid() = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id = auth.uid())
    );

-- Create RLS policy: Users can insert their own characters
CREATE POLICY "Users can insert own characters" ON public.owlcloud_characters
    FOR INSERT WITH CHECK (
        auth.uid() = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id = auth.uid())
    );

-- Create RLS policy: Users can update their own characters
CREATE POLICY "Users can update own characters" ON public.owlcloud_characters
    FOR UPDATE USING (
        auth.uid() = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id = auth.uid())
    );

-- Create RLS policy: Users can delete their own characters
CREATE POLICY "Users can delete own characters" ON public.owlcloud_characters
    FOR DELETE USING (
        auth.uid() = (SELECT user_id_dicecloud FROM public.auth_tokens WHERE user_id = auth.uid())
    );

-- Create RLS policy: Service role can access all characters (for bot operations)
CREATE POLICY "Service role full access" ON public.owlcloud_characters
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );
