import { act, render, screen } from "@testing-library/react";
import { DropCountdown } from "@/components/drop/DropCountdown";

describe("DropCountdown", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("ticks down every second, fires onLive when reaching zero, and clears interval on unmount", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    const onLive = jest.fn();

    const { unmount } = render(
      <DropCountdown dropDate="2026-01-01T00:00:03.000Z" onLive={onLive} />,
    );

    expect(screen.getByText("03")).toBeInTheDocument();
    expect(onLive).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText("02")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onLive).toHaveBeenCalledTimes(1);

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it("fires onLive immediately when dropDate is already in the past", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:10.000Z"));

    const onLive = jest.fn();

    render(
      <DropCountdown dropDate="2026-01-01T00:00:00.000Z" onLive={onLive} />,
    );

    expect(onLive).toHaveBeenCalledTimes(1);
  });
});
