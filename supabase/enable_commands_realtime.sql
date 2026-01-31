-- Enable Supabase Realtime for owlcloud_commands table
-- This is required for the extension to receive commands instantly via WebSocket
-- instead of polling every 2 seconds.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Add owlcloud_commands to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE owlcloud_commands;
