import { useCallback } from 'react';
import {
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor,
    KeyboardSensor,
    DragEndEvent
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { WeatherData } from '../services/weatherApi';

interface UseWeatherDragDropProps {
    weatherList: WeatherData[];
    reorderCities: (oldIndex: number, newIndex: number) => void;
}

export function useWeatherDragDrop({ weatherList, reorderCities }: UseWeatherDragDropProps) {
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = weatherList.findIndex((w) => w.city === active.id);
            const newIndex = weatherList.findIndex((w) => w.city === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                reorderCities(oldIndex, newIndex);
            }
        }
    }, [weatherList, reorderCities]);

    return { sensors, handleDragEnd };
}
