import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

const AudioWaveform = ({ audioLevel }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const bars = 20;
        const barWidth = width / bars - 2;

        const draw = () => {
            ctx.clearRect(0, 0, width, height);
            for (let i = 0; i < bars; i++) {
                const barHeight = (height * audioLevel * (Math.random() * 0.5 + 0.5)) / 2;
                ctx.fillStyle = `hsl(${(i / bars) * 360}, 70%, 50%)`;
                ctx.fillRect(i * (barWidth + 2), height / 2 - barHeight / 2, barWidth, barHeight);
            }
        };

        draw();
    }, [audioLevel]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-xs"
        >
            <canvas ref={canvasRef} width={300} height={50} className="w-full" />
        </motion.div>
    );
};

export default AudioWaveform;