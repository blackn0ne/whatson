"use client";

import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds === 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

interface CustomAudioPlayerProps {
  src: string;
  isMe: boolean;
}

export function CustomAudioPlayer({ src, isMe }: CustomAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const newTime = Number(e.target.value);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const togglePlaybackSpeed = () => {
    const speeds = [1, 1.5, 2];
    const currentSpeedIndex = speeds.indexOf(playbackSpeed);
    const nextSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
    const newSpeed = speeds[nextSpeedIndex];
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };
  
  const playerColorClass = isMe ? 'accent-green-600' : 'accent-blue-600';

  return (
    <div className="flex items-center gap-2 w-full max-w-xs my-1">
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        className="hidden"
      />
      <Button 
        variant="ghost" 
        size="icon" 
        className="rounded-full h-8 w-8" 
        onClick={togglePlayPause}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <span className="text-xs text-gray-600 min-w-[36px]">{formatTime(currentTime)}</span>
      <input
        type="range"
        min="0"
        max={duration || 0}
        value={currentTime}
        onChange={handleScrubberChange}
        className={`flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer ${playerColorClass}`}
      />
      <span className="text-xs text-gray-600 min-w-[36px]">{formatTime(duration)}</span>
      <Button 
        variant="ghost" 
        size="sm" 
        className="rounded-full h-8 px-2 text-xs font-semibold" 
        onClick={togglePlaybackSpeed}
      >
        {playbackSpeed}x
      </Button>
    </div>
  );
}