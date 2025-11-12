from typing import List
from app.models.transcription import Segment, ExportFormat
import csv
import json
from io import StringIO


class ExportService:
    """Service for exporting transcriptions to various formats."""
    
    @staticmethod
    def to_srt(segments: List[Segment]) -> str:
        """Convert segments to SRT format."""
        srt_content = []
        
        for i, seg in enumerate(segments, 1):
            start = ExportService._format_timestamp(seg.start)
            end = ExportService._format_timestamp(seg.end)
            
            srt_content.append(f"{i}")
            srt_content.append(f"{start} --> {end}")
            srt_content.append(seg.text)
            srt_content.append("")  # Blank line
        
        return "\n".join(srt_content)
    
    @staticmethod
    def to_vtt(segments: List[Segment]) -> str:
        """Convert segments to WebVTT format."""
        vtt_content = ["WEBVTT", ""]
        
        for seg in segments:
            start = ExportService._format_timestamp(seg.start)
            end = ExportService._format_timestamp(seg.end)
            
            vtt_content.append(f"{start} --> {end}")
            vtt_content.append(seg.text)
            vtt_content.append("")
        
        return "\n".join(vtt_content)
    
    @staticmethod
    def to_txt(segments: List[Segment]) -> str:
        """Convert segments to plain text."""
        return "\n".join([seg.text for seg in segments])
    
    @staticmethod
    def to_csv(segments: List[Segment]) -> str:
        """Convert segments to CSV format."""
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["Start", "End", "Text"])
        for seg in segments:
            writer.writerow([seg.start, seg.end, seg.text])
        
        return output.getvalue()
    
    @staticmethod
    def to_json(segments: List[Segment]) -> str:
        """Convert segments to JSON format."""
        data = [
            {
                "start": seg.start,
                "end": seg.end,
                "text": seg.text
            }
            for seg in segments
        ]
        return json.dumps(data, indent=2)
    
    @staticmethod
    def _format_timestamp(seconds: float) -> str:
        """Format seconds to HH:MM:SS,mmm format."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
    
    @classmethod
    def export(cls, segments: List[Segment], format: ExportFormat) -> str:
        """Export segments to specified format."""
        if format == ExportFormat.SRT:
            return cls.to_srt(segments)
        elif format == ExportFormat.VTT:
            return cls.to_vtt(segments)
        elif format == ExportFormat.TXT:
            return cls.to_txt(segments)
        elif format == ExportFormat.CSV:
            return cls.to_csv(segments)
        elif format == ExportFormat.JSON:
            return cls.to_json(segments)
        else:
            raise ValueError(f"Unsupported format: {format}")