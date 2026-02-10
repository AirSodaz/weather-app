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

interface WeatherDragDropProps {
    weatherList: WeatherData[];
    reorderCities: (oldIndex: number, newIndex: number) => void;
}

export interface WeatherDragDropHook {
    sensors: ReturnType<typeof useSensors>;
    handleDragEnd: (event: DragEndEvent) => void;
}

export function useWeatherDragDrop({ weatherList, reorderCities }: WeatherDragDropProps): WeatherDragDropHook {
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
            reorderCities(oldIndex, newIndex);
        }
    }, [weatherList, reorderCities]);

    return { sensors, handleDragEnd };
}
